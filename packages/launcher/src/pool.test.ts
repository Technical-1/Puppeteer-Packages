import { describe, it, expect, vi } from "vitest";
import { BrowserPool } from "./pool.js";

function mockPuppeteer() {
  let n = 0;
  const created: Array<{ id: number; close: ReturnType<typeof vi.fn> }> = [];
  const puppeteer = {
    launch: vi.fn(async () => {
      const b = { id: ++n, close: vi.fn().mockResolvedValue(undefined) };
      created.push(b);
      return b;
    }),
  };
  return { puppeteer, created };
}

describe("BrowserPool", () => {
  it("creates at most `size` browsers and reuses released ones", async () => {
    const { puppeteer } = mockPuppeteer();
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

  it("queues acquire calls until a browser is released when at capacity", async () => {
    const { puppeteer } = mockPuppeteer();
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 1 });
    const first = await pool.acquire();
    let got = false;
    const pending = pool.acquire().then((b) => {
      got = true;
      return b;
    });
    await Promise.resolve();
    expect(got).toBe(false);
    pool.release(first);
    const second = await pending;
    expect(got).toBe(true);
    expect(second).toBe(first);
    await pool.drain();
  });

  it("drain() closes every created browser", async () => {
    const { puppeteer, created } = mockPuppeteer();
    const pool = new BrowserPool(puppeteer as never, { executablePath: "/c" }, { size: 2 });
    await pool.acquire();
    const b = await pool.acquire();
    pool.release(b);
    await pool.drain();
    expect(created).toHaveLength(2);
    for (const br of created) expect(br.close).toHaveBeenCalledTimes(1);
  });
});
