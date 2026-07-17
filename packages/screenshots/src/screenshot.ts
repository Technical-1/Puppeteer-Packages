import { PptrKitError, SelectorNotFoundError } from "@technical-1/core";
import type { Page, ScreenshotOptions } from "puppeteer-core";

/**
 * Take a page screenshot. Returns the raw image bytes (`Uint8Array`) and/or
 * writes to `opts.path` per puppeteer's normal behavior. The `encoding` option
 * is intentionally excluded — this helper always returns binary bytes; call
 * puppeteer-core directly if you need a base64 string.
 *
 * Throws `PptrKitError` (`retryable:true`) wrapping any puppeteer failure as
 * `cause`. Transient page errors usually succeed on a retry; persistent
 * caller errors (e.g. invalid options) are also wrapped but the retry layer
 * will exhaust quickly.
 */
export async function screenshot(
  page: Page,
  opts: Omit<ScreenshotOptions, "encoding"> = {},
): Promise<Uint8Array> {
  try {
    return await page.screenshot(opts);
  } catch (cause) {
    throw new PptrKitError("screenshot failed", { retryable: true, cause });
  }
}

/**
 * Resolve `selector` to an `ElementHandle` and take its screenshot.
 *
 * Throws `SelectorNotFoundError` (`retryable:false`, deterministic) when
 * the selector does not match. Other failures are wrapped as
 * `PptrKitError` (`retryable:true`).
 */
export async function screenshotElement(
  page: Page,
  selector: string,
  opts: Omit<ScreenshotOptions, "encoding"> = {},
): Promise<Uint8Array> {
  let el;
  try {
    el = await page.$(selector);
  } catch (cause) {
    throw new PptrKitError("screenshotElement: page.$ failed", { retryable: true, cause });
  }
  if (el === null) throw new SelectorNotFoundError(selector);
  try {
    return await el.screenshot(opts);
  } catch (cause) {
    throw new PptrKitError("screenshotElement: element.screenshot failed", { retryable: true, cause });
  }
}
