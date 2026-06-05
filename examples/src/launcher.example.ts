/**
 * @technical-1/launcher — withBrowser / BrowserPool demo
 *
 * Demonstrates the scoped `withBrowser` lifecycle helper (guaranteed close) and
 * `BrowserPool` for concurrent-tab scenarios.
 *
 * These calls are typecheck-only (not executed in CI). Export the demo
 * functions so lint does not flag them as unused.
 */

import { withBrowser, BrowserPool } from "@technical-1/launcher";
import type { LaunchOptions, PuppeteerLike } from "@technical-1/launcher";
import type { Browser } from "puppeteer-core";
import { createConsoleLogger } from "@technical-1/logger";

const logger = createConsoleLogger({ minLevel: "info" });

// ── withBrowser — scoped lifecycle ───────────────────────────────────────────
// The launcher accepts an injected `puppeteer` instance (DI pattern) so the
// example can be typecheck-only without launching real Chrome.

export async function withBrowserDemo(puppeteer: PuppeteerLike): Promise<void> {
  const opts: LaunchOptions = {
    executablePath: "/path/to/chrome",
    headless: true,
    logger,
  };

  const title = await withBrowser(puppeteer, opts, async (browser: Browser) => {
    const page = await browser.newPage();
    return page.title();
  });

  console.log("page title:", title);
  // => '' (no navigation yet — just demonstrates the API shape)
}

// ── BrowserPool — fixed-size concurrent pool ─────────────────────────────────
export async function poolDemo(puppeteer: PuppeteerLike): Promise<void> {
  const opts: LaunchOptions = {
    executablePath: "/path/to/chrome",
    headless: true,
  };

  const pool = new BrowserPool(puppeteer, opts, { size: 2 });

  const browser = await pool.acquire();
  console.log("acquired browser:", typeof browser);
  // => object
  pool.release(browser);

  await pool.drain();
  console.log("pool drained");
}
