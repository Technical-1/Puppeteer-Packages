/**
 * @technical-1/stealth — applyStealth demo
 *
 * Demonstrates wrapping a puppeteer instance with puppeteer-extra and the
 * stealth plugin to reduce bot-detection fingerprints.
 *
 * `applyStealth` accepts a `VanillaPuppeteer` (from puppeteer-extra); since
 * `PuppeteerNode` structurally satisfies that interface the demo receives a
 * `PuppeteerNode` and passes it through. Typecheck-only — not executed in CI.
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
