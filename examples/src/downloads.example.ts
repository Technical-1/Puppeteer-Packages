/**
 * @technical-1/downloads — enableDownloads / awaitDownload demo
 *
 * Demonstrates configuring Chrome's download directory via CDP and then
 * awaiting a triggered download to complete via filesystem polling.
 *
 * Injected `Browser`/`Page` pattern — typecheck-only, not executed in CI.
 */

import { enableDownloads, awaitDownload } from "@technical-1/downloads";
import type { DownloadResult, AwaitDownloadOptions } from "@technical-1/downloads";
import type { Browser, Page } from "puppeteer-core";

export async function demo(browser: Browser, page: Page): Promise<void> {
  const downloadDir = "./downloads";

  // ── Enable downloads to a target directory ────────────────────────────────
  // Sends CDP Browser.setDownloadBehavior with policy "allow".
  // Call once per browser session; subsequent calls with the same dir are
  // idempotent for Chrome.
  await enableDownloads(browser, downloadDir);
  console.log("downloads directed to:", downloadDir);

  // ── Await a triggered download ────────────────────────────────────────────
  // awaitDownload snapshots the directory, invokes the trigger, then polls
  // every 100ms until a new non-.crdownload file appears.
  // Only the public surface (awaitDownload) is used — awaitDownloadForTesting
  // is an internal shim and is NOT exported from the barrel.
  const opts: AwaitDownloadOptions = {
    timeoutMs: 30_000,
    pollMs: 200,
  };

  const result: DownloadResult = await awaitDownload(
    downloadDir,
    async () => {
      // In real usage click the element that triggers the download:
      await page.click("#download-button");
    },
    opts,
  );

  console.log("download complete:", result.filename);
  console.log("path:", result.path);
  console.log("size (bytes):", result.size);
}
