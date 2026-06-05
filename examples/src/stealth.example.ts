/**
 * @technical-1/stealth — applyStealth demo
 *
 * Demonstrates wrapping a puppeteer instance with puppeteer-extra and the
 * stealth plugin to reduce bot-detection fingerprints.
 *
 * `applyStealth` expects a `VanillaPuppeteer` (from puppeteer-extra). Passing a
 * raw `PuppeteerNode` from puppeteer-core compiles here because this project
 * sets `skipLibCheck: true`; puppeteer-core@24 dropped `createBrowserFetcher`,
 * which `VanillaPuppeteer` still requires. In stricter projects use the full
 * `puppeteer` package or cast via `unknown as VanillaPuppeteer`.
 * Typecheck-only — not executed in CI.
 */

import { applyStealth } from "@technical-1/stealth";
import { withBrowser } from "@technical-1/launcher";
import type { LaunchOptions } from "@technical-1/launcher";
import type { PuppeteerNode } from "puppeteer-core";

export async function demo(puppeteer: PuppeteerNode): Promise<void> {
  // applyStealth wraps the raw puppeteer instance with puppeteer-extra and
  // registers the stealth plugin.  The return value is a PuppeteerExtra
  // instance that satisfies PuppeteerLike — pass it straight to withBrowser.
  const stealthPuppeteer = applyStealth(puppeteer);

  const opts: LaunchOptions = {
    executablePath: "/path/to/chrome",
    headless: true,
  };

  const title = await withBrowser(stealthPuppeteer, opts, async (browser) => {
    const page = await browser.newPage();
    return page.title();
  });

  console.log("stealth page title:", title);
  // => "" (no navigation — just confirms the API shape typechecks)
}
