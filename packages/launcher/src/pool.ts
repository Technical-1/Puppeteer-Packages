import type { Browser } from "puppeteer-core";
import { launch, type LaunchOptions, type PuppeteerLike } from "./launcher.js";

export interface PoolOptions {
  /** Maximum concurrent browsers. Default 1. */
  size?: number;
}

interface Waiter {
  resolve: (browser: Browser) => void;
  reject: (err: unknown) => void;
}

/**
 * Fixed-size pool of lazily-launched browsers.
 *
 * `acquire()` returns an idle browser, launches a new one if the pool is
 * below `size` (the slot is reserved SYNCHRONOUSLY before the await, so
 * concurrent acquires can never exceed `size`), or queues until a
 * `release()`.
 *
 * `drain()` is a FORCED shutdown: it closes EVERY browser the pool created,
 * INCLUDING any currently acquired/in-use — callers must stop using acquired
 * browsers before draining. Pending `acquire()` promises are rejected. After
 * drain the pool is unusable (further `acquire()` rejects).
 *
 * v1 limitations (documented, intentional): an idle browser that crashed
 * while pooled is returned as-is (no liveness check); the sandbox args in
 * `launch` cannot be removed by a consumer.
 */
export class BrowserPool {
  readonly #puppeteer: PuppeteerLike;
  readonly #opts: LaunchOptions;
  readonly #size: number;
  readonly #idle: Browser[] = [];
  readonly #busy = new Set<Browser>();
  readonly #waiters: Waiter[] = [];
  /** Browsers counting against #size: idle + busy + in-flight launches. */
  #reserved = 0;
  #drained = false;

  constructor(puppeteer: PuppeteerLike, opts: LaunchOptions, poolOpts: PoolOptions = {}) {
    this.#puppeteer = puppeteer;
    this.#opts = opts;
    this.#size = poolOpts.size ?? 1;
  }

  async acquire(): Promise<Browser> {
    if (this.#drained) throw new Error("BrowserPool has been drained");
    const idle = this.#idle.pop();
    if (idle) {
      this.#busy.add(idle);
      return idle;
    }
    if (this.#reserved < this.#size) {
      this.#reserved += 1; // reserve synchronously — closes the TOCTOU window
      let browser: Browser;
      try {
        browser = await launch(this.#puppeteer, this.#opts);
      } catch (err) {
        this.#reserved -= 1; // roll back so the slot (and waiters) recover
        this.#serveNextWaiter();
        throw err;
      }
      if (this.#drained) {
        // Pool drained while this launch was in flight — don't leak it.
        await browser.close().catch(() => {});
        throw new Error("BrowserPool has been drained");
      }
      this.#busy.add(browser);
      return browser;
    }
    return new Promise<Browser>((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }

  release(browser: Browser): void {
    if (!this.#busy.delete(browser)) return; // foreign / double release — ignore
    // drain() atomically sets #drained and clears #busy in the same synchronous turn;
    // a browser cannot be in #busy after drain() has run, so this guard is defensive
    // dead-code in Node's single-threaded model — kept for safety if the implementation
    // ever adds an async gap before #busy.clear().
    /* v8 ignore next 4 -- unreachable in single-threaded Node: drain() clears #busy synchronously */
    if (this.#drained) {
      void browser.close().catch(() => {});
      return;
    }
    const waiter = this.#waiters.shift();
    if (waiter) {
      this.#busy.add(browser);
      waiter.resolve(browser);
      return;
    }
    this.#idle.push(browser);
  }

  async drain(): Promise<void> {
    this.#drained = true;
    const waiters = this.#waiters.splice(0);
    for (const w of waiters) w.reject(new Error("BrowserPool has been drained"));
    const all = [...this.#idle, ...this.#busy];
    this.#idle.length = 0;
    this.#busy.clear();
    this.#reserved = 0;
    const results = await Promise.allSettled(all.map((b) => b.close()));
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failed.length > 0) {
      throw new AggregateError(
        failed.map((f) => f.reason),
        `BrowserPool.drain: ${failed.length} browser(s) failed to close`,
      );
    }
  }

  /** After a freed reservation, let the oldest waiter launch a fresh browser. */
  #serveNextWaiter(): void {
    if (this.#drained) return;
    if (this.#reserved >= this.#size) return;
    const waiter = this.#waiters.shift();
    if (!waiter) return;
    this.#reserved += 1;
    launch(this.#puppeteer, this.#opts).then(
      (browser) => {
        if (this.#drained) {
          void browser.close().catch(() => {});
          waiter.reject(new Error("BrowserPool has been drained"));
          return;
        }
        this.#busy.add(browser);
        waiter.resolve(browser);
      },
      (err) => {
        this.#reserved -= 1;
        waiter.reject(err);
        this.#serveNextWaiter();
      },
    );
  }
}
