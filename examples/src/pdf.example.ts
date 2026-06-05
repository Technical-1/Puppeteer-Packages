/**
 * @technical-1/pdf — pageToPdf demo
 *
 * Demonstrates rendering a page to PDF with the built-in defaults (A4,
 * printBackground: true, 1cm margins) and with caller-supplied overrides.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import { pageToPdf } from "@technical-1/pdf";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Default options (A4, printBackground: true, 1 cm margins) ─────────────
  // Returns a Uint8Array when no `path` is provided.
  const pdfBytes: Uint8Array = await pageToPdf(page);
  console.log("PDF buffer bytes:", pdfBytes.byteLength);

  // ── Override format + write to disk ───────────────────────────────────────
  // Options shallow-merge over the defaults — pass all four margin sides if
  // overriding the margin object (the merge is shallow, not deep).
  await pageToPdf(page, { format: "Letter", path: "./report.pdf" });
  console.log("PDF written to ./report.pdf");

  // ── Print background + custom margins ─────────────────────────────────────
  const widePdf: Uint8Array = await pageToPdf(page, {
    format: "A4",
    printBackground: true,
    margin: { top: "2cm", bottom: "2cm", left: "2.5cm", right: "2.5cm" },
  });
  console.log("wide-margin PDF bytes:", widePdf.byteLength);
}
