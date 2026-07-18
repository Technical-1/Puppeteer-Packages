import { DownloadError } from "@technical-1/core";
import type { Browser } from "puppeteer-core";

/**
 * Enable downloads to `dir` by sending CDP `Browser.setDownloadBehavior`
 * with policy `"allow"`, `downloadPath: dir`, and `eventsEnabled: true`
 * (forward-compatible with the v2 `Browser.downloadProgress` event path
 * even though v1 uses filesystem polling).
 *
 * Idempotent: calling again with the same dir is a no-op for Chrome.
 * Calling with a different dir overrides the previous behavior.
 *
 * Throws `DownloadError` (`retryable:true`) wrapping CDP failures as `cause`.
 */
export async function enableDownloads(browser: Browser, dir: string): Promise<void> {
  try {
    const cdp = await browser.target().createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: dir,
      eventsEnabled: true,
    });
  } catch (cause) {
    throw new DownloadError("enableDownloads failed", { retryable: true, cause });
  }
}
