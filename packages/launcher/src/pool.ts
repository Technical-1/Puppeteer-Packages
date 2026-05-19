import type { Browser } from "puppeteer-core";
import { launch, type LaunchOptions, type PuppeteerLike } from "./launcher.js";

export interface PoolOptions {
  /** Maximum concurrent browsers. Default 1. */
  size?: number;
}

/**
 * Fixed-size pool of lazily-launched browsers. `acquire()` reuses an idle
 * browser, launches a new one up to `size`, or waits for a `release()`.
 * `drain()` closes every browser the pool created.
 */
export class BrowserPool {
  readonly #puppeteer: PuppeteerLike;
  readonly #opts: LaunchOptions;
  readonly #size: number;
  readonly #idle: Browser[] = [];
  readonly #all = new Set<Browser>();
  readonly #waiters: Array<(b: Browser) => void> = [];

  constructor(puppeteer: PuppeteerLike, opts: LaunchOptions, poolOpts: PoolOptions = {}) {
    this.#puppeteer = puppeteer;
    this.#opts = opts;
    this.#size = poolOpts.size ?? 1;
  }

  async acquire(): Promise<Browser> {
    const idle = this.#idle.pop();
    if (idle) return idle;
    if (this.#all.size < this.#size) {
      const browser = await launch(this.#puppeteer, this.#opts);
      this.#all.add(browser);
      return browser;
    }
    return new Promise<Browser>((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  release(browser: Browser): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter(browser);
      return;
    }
    this.#idle.push(browser);
  }

  async drain(): Promise<void> {
    const all = [...this.#all];
    this.#all.clear();
    this.#idle.length = 0;
    this.#waiters.length = 0;
    await Promise.all(all.map((b) => b.close()));
  }
}
