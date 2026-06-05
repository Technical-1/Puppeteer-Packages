import { PptrKitError } from "@technical-1/core";
import type { Page, PDFOptions } from "puppeteer-core";

const DEFAULTS: PDFOptions = {
  format: "A4",
  printBackground: true,
  margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
};

/**
 * Render `page` to a PDF. Caller options shallow-merge over defensible
 * defaults (`A4`, `printBackground: true`, 1cm margins). The `margin` object
 * is DEEP-merged per side: a partial margin (e.g. `{ top: "2cm" }`) keeps the
 * unspecified sides at the 1cm default rather than dropping them to 0.
 *
 * Throws `PptrKitError` (`retryable:true`) wrapping puppeteer-core failures
 * as `cause`. Note: `page.pdf()` requires a headless Chrome — running
 * headful raises a runtime error that this wrapper does NOT rescue.
 */
export async function pageToPdf(page: Page, opts: PDFOptions = {}): Promise<Uint8Array> {
  const merged: PDFOptions = {
    ...DEFAULTS,
    ...opts,
    margin: { ...DEFAULTS.margin, ...opts.margin },
  };
  try {
    return await page.pdf(merged);
  } catch (cause) {
    throw new PptrKitError("pageToPdf failed", { retryable: true, cause });
  }
}
