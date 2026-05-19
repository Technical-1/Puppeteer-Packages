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
});
