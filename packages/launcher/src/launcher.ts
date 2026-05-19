import type { Browser, PuppeteerNode } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";

/** Minimal injected puppeteer surface — just what launch needs. */
export type PuppeteerLike = Pick<PuppeteerNode, "launch">;

export interface LaunchOptions extends LoggerOption {
  /** Chrome executable path (from @technical-1/chrome-setup). */
  executablePath: string;
  /** Headless mode. Default true. */
  headless?: boolean;
  /** Extra Chrome args, appended after the sandbox defaults (which a consumer
   *  cannot remove via this option). */
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

/** Close a browser without ever throwing; a close failure is only logged. */
async function closeQuietly(browser: Browser, opts: LaunchOptions): Promise<void> {
  try {
    await browser.close();
    opts.logger?.log("Browser closed", "info");
  } catch (closeErr) {
    opts.logger?.log(
      `Browser close failed: ${
        closeErr instanceof Error ? closeErr.message : String(closeErr)
      }`,
      "warn",
    );
  }
}

/**
 * Launch a browser, run `fn`, and ALWAYS close the browser afterward (spec
 * §8 — a thrown error never leaks a browser process). A failure to `close()`
 * is logged, never thrown: it must not mask a `fn` error nor discard a `fn`
 * result.
 */
export async function withBrowser<T>(
  puppeteer: PuppeteerLike,
  opts: LaunchOptions,
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const browser = await launch(puppeteer, opts);
  let result: T;
  try {
    result = await fn(browser);
  } catch (err) {
    await closeQuietly(browser, opts);
    throw err;
  }
  await closeQuietly(browser, opts);
  return result;
}
