import type { Browser, PuppeteerNode } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";

/** Minimal injected puppeteer surface — just what launch needs. */
export type PuppeteerLike = Pick<PuppeteerNode, "launch">;

export interface LaunchOptions extends LoggerOption {
  /** Chrome executable path (from @technical-1/chrome-setup). */
  executablePath: string;
  /** Headless mode. Default true. */
  headless?: boolean;
  /** Extra Chrome args, appended after the sandbox defaults. */
  args?: string[];
}

const SANDBOX_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

/** Launch a browser with sane defaults. The caller injects `puppeteer`. */
export async function launch(
  puppeteer: PuppeteerLike,
  opts: LaunchOptions,
): Promise<Browser> {
  const headless = opts.headless ?? true;
  opts.logger?.log(`Launching Chrome (${headless ? "headless" : "headed"})`, "step");
  return puppeteer.launch({
    executablePath: opts.executablePath,
    headless,
    args: [...SANDBOX_ARGS, ...(opts.args ?? [])],
  });
}

/**
 * Launch a browser, run `fn`, and ALWAYS close the browser in a `finally`
 * (spec §8 — a thrown error never leaks a browser process).
 */
export async function withBrowser<T>(
  puppeteer: PuppeteerLike,
  opts: LaunchOptions,
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const browser = await launch(puppeteer, opts);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
    opts.logger?.log("Browser closed", "info");
  }
}
