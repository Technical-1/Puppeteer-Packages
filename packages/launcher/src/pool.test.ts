import { describe, it, expect, vi } from "vitest";
import { BrowserPool } from "./pool.js";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("BrowserPool", () => {
  it("never exceeds `size` under concurrent acquire (TOCTOU)", async () => {
    const gate = deferred<void>();
    let n = 0;
    const puppeteer = {
      launch: vi.fn(async () => {
        await gate.promise;
        return { id: ++n, close: vi.fn().mockResolvedValue(undefined) };
      }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    await Promise.resolve();
    expect(puppeteer.launch).toHaveBeenCalledTimes(1); // not 3
    gate.resolve();
    const first = await a;
    let bResolved = false;
    void b.then(() => {
      bResolved = true;
    });
    await Promise.resolve();
    expect(bResolved).toBe(false); // queued, not over-launched
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    pool.release(first);
    expect(await b).toBe(first); // reused, still one launch
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    pool.release(await b);
    await c;
    await pool.drain();
  });

  it("creates at most `size` browsers and reuses released ones", async () => {
    let n = 0;
    const puppeteer = {
      launch: vi.fn(async () => ({ id: ++n, close: vi.fn().mockResolvedValue(undefined) })),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 2 });
    const a = await pool.acquire();
    await pool.acquire();
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    pool.release(a);
    const c = await pool.acquire();
    expect(c).toBe(a);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    await pool.drain();
  });

  it("rejects an acquire when launch fails, frees the slot, no deadlock", async () => {
    const puppeteer = {
      launch: vi
        .fn()
        .mockRejectedValueOnce(new Error("launch failed"))
        .mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    await expect(pool.acquire()).rejects.toThrow("launch failed");
    const b = await pool.acquire();
    expect(b).toBeDefined();
    await pool.drain();
  });

  it("drain() rejects pending waiters instead of hanging them", async () => {
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    await pool.acquire();
    const waiter = pool.acquire();
    const settled = waiter.then(
      () => "resolved",
      (e) => `rejected:${(e as Error).message}`,
    );
    await pool.drain();
    expect(await settled).toMatch(/rejected:.*drained/);
  });

  it("drain() attempts every close and aggregates failures", async () => {
    const good = { close: vi.fn().mockResolvedValue(undefined) };
    const bad = { close: vi.fn().mockRejectedValue(new Error("close boom")) };
    let i = 0;
    const puppeteer = { launch: vi.fn(async () => (i++ === 0 ? good : bad)) };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 2 });
    const a = await pool.acquire();
    await pool.acquire();
    pool.release(a);
    await expect(pool.drain()).rejects.toThrow(/failed to close/);
    expect(good.close).toHaveBeenCalledTimes(1);
    expect(bad.close).toHaveBeenCalledTimes(1);
  });

  it("acquire() after drain rejects", async () => {
    const puppeteer = {
      launch: vi.fn().mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    await pool.drain();
    await expect(pool.acquire()).rejects.toThrow(/drained/);
  });

  it("ignores release of a foreign or double-released browser", async () => {
    const puppeteer = {
      launch: vi.fn(async () => ({ close: vi.fn().mockResolvedValue(undefined) })),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    const a = await pool.acquire();
    pool.release(a);
    pool.release(a); // double — ignored
    pool.release({ close: vi.fn() } as never); // foreign — ignored
    const b = await pool.acquire();
    expect(b).toBe(a); // single clean reuse
    await pool.drain();
  });

  it("release() on an already-drained pool is a no-op (does not throw)", async () => {
    // drain() synchronously clears #busy, so a release() called after await drain()
    // hits the foreign/double-release guard and returns silently — no throw, no
    // double-close. The test also confirms drain() itself resolves without error.
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    const acquired = await pool.acquire();
    // drain() resolves cleanly (closes the acquired browser, no error)
    await expect(pool.drain()).resolves.toBeUndefined();
    expect(browser.close).toHaveBeenCalledTimes(1);
    // release() of the stale handle after drain must not throw and must not
    // produce a second close() call (the pool no longer tracks this browser).
    expect(() => pool.release(acquired)).not.toThrow();
    expect(browser.close).toHaveBeenCalledTimes(1); // still exactly once
  });

  it("pool drained during in-flight launch: browser is closed and acquire rejects", async () => {
    // Covers pool.ts lines 65-69: the post-launch drained check inside acquire().
    const launchGate = deferred<void>();
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    const puppeteer = {
      launch: vi.fn(async () => {
        await launchGate.promise;
        return browser;
      }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });

    // Start acquire (launch is blocked on launchGate)
    const acquirePromise = pool.acquire();

    // Drain the pool WHILE launch is in-flight
    const drainPromise = pool.drain();

    // Now unblock the launch — browser resolves, but pool is drained
    launchGate.resolve();

    // The acquire should reject with "drained"
    await expect(acquirePromise).rejects.toThrow(/drained/);
    // drain itself should succeed (no browsers were tracked in idle/busy before drain)
    await drainPromise;
    // The in-flight browser should have been closed to avoid a leak
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("#serveNextWaiter: waiter receives browser when a slot frees after launch failure", async () => {
    // Covers pool.ts lines 119-135: #serveNextWaiter called after rollback.
    // Two concurrent acquires on a size-1 pool; first launch fails; second gets a browser.
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    const puppeteer = {
      launch: vi.fn()
        .mockRejectedValueOnce(new Error("first launch boom"))
        .mockResolvedValue(browser),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });

    // Fill the pool slot so the second acquire queues as a waiter
    const firstAcquire = pool.acquire(); // triggers first launch (will fail)
    const secondAcquire = pool.acquire(); // queued — no slot yet

    // First acquire rejects; rollback triggers #serveNextWaiter which launches for the waiter
    await expect(firstAcquire).rejects.toThrow("first launch boom");
    // Second acquire should now resolve with the second (successful) browser
    const result = await secondAcquire;
    expect(result).toBe(browser);
    await pool.drain();
  });

  it("#serveNextWaiter: waiter is rejected when pool is drained mid-launch in serveNextWaiter", async () => {
    // Covers pool.ts lines 122-125: drained branch inside #serveNextWaiter's .then().
    // Setup: first acquire fails (triggering #serveNextWaiter for the queued waiter),
    // but we drain WHILE #serveNextWaiter's launch is in-flight.
    const firstLaunchGate = deferred<void>();
    const serveGate = deferred<void>();
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    let callCount = 0;
    const puppeteer = {
      launch: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // First acquire's launch: blocks, then fails
          await firstLaunchGate.promise;
          throw new Error("first launch fail");
        }
        // #serveNextWaiter's launch: blocks until serveGate resolves
        await serveGate.promise;
        return browser;
      }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });

    // Start first acquire (will fail once gate opens)
    const first = pool.acquire();
    // Queue waiter (pool at capacity — #reserved = 1)
    const waiterPromise = pool.acquire();

    // Open the first gate — first launch fails, triggering #serveNextWaiter
    firstLaunchGate.resolve();
    await expect(first).rejects.toThrow("first launch fail");

    // Now #serveNextWaiter is running with serveGate blocking the launch.
    // Drain the pool while the #serveNextWaiter launch is in-flight.
    const drainPromise = pool.drain();

    // Unblock #serveNextWaiter's launch — but pool is now drained
    serveGate.resolve();

    // Waiter should be rejected (drained)
    await expect(waiterPromise).rejects.toThrow(/drained/);
    await drainPromise;
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("#serveNextWaiter: waiter is rejected and next waiter gets a retry when launch fails", async () => {
    // Covers pool.ts lines 130-134: error branch in #serveNextWaiter.
    // Setup: first acquire fails (rollback → serveNextWaiter for waiter1 → that also fails
    // → rollback → serveNextWaiter for waiter2 → succeeds).
    const browser = { close: vi.fn().mockResolvedValue(undefined) };
    let callCount = 0;
    const puppeteer = {
      launch: vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error("first acquire boom");
        if (callCount === 2) throw new Error("serve waiter boom");
        return browser;
      }),
    };
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });

    // First acquire gets the slot (#reserved = 1), two more queue as waiters
    const firstAcquire = pool.acquire();
    const waiter1 = pool.acquire();
    const waiter2 = pool.acquire();

    // First acquire rejects → rollback → #serveNextWaiter for waiter1 (launch #2 fails)
    await expect(firstAcquire).rejects.toThrow("first acquire boom");
    // waiter1 should be rejected because #serveNextWaiter's launch also failed
    await expect(waiter1).rejects.toThrow("serve waiter boom");
    // waiter2 should be served by the third launch (succeeds)
    const result = await waiter2;
    expect(result).toBe(browser);
    await pool.drain();
  });
});

describe("BrowserPool size validation", () => {
  const puppeteer = { launch: vi.fn() };
  const opts = { executablePath: "/c" };

  it("throws a terminal PptrKitError for size: 0", () => {
    try {
      new BrowserPool(puppeteer as never, opts, { size: 0 });
      throw new Error("expected constructor to throw");
    } catch (err) {
      expect(err).toMatchObject({ name: "PptrKitError", retryable: false });
      expect((err as { context: { size: number } }).context.size).toBe(0);
    }
    expect(puppeteer.launch).not.toHaveBeenCalled();
  });

  it("throws for a negative size", () => {
    expect(() => new BrowserPool(puppeteer as never, opts, { size: -2 })).toThrow(
      /positive integer/,
    );
  });

  it("throws for a non-integer / NaN size", () => {
    expect(() => new BrowserPool(puppeteer as never, opts, { size: 1.5 })).toThrow(
      /positive integer/,
    );
    expect(() => new BrowserPool(puppeteer as never, opts, { size: NaN })).toThrow(
      /positive integer/,
    );
  });

  it("still accepts a valid positive integer size", () => {
    expect(() => new BrowserPool(puppeteer as never, opts, { size: 3 })).not.toThrow();
    expect(() => new BrowserPool(puppeteer as never, opts, {})).not.toThrow(); // defaults to 1
  });
});
