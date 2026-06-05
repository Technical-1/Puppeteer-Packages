/**
 * @technical-1/screenshots — screenshot / screenshotElement / timestampedPath demo
 *
 * Demonstrates capturing full-page screenshots, element-scoped screenshots,
 * and writing to disk with a timestamped filename.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import {
  screenshot,
  screenshotElement,
  timestampedPath,
} from "@technical-1/screenshots";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Full-page screenshot to Buffer ────────────────────────────────────────
  // No `path` option → returns a Uint8Array (puppeteer-core's Buffer equivalent).
  const buf: Uint8Array = await screenshot(page, { fullPage: true });
  console.log("screenshot buffer bytes:", buf.byteLength);

  // ── Write to disk with a timestamped filename ─────────────────────────────
  // timestampedPath generates a portable filesystem-safe name like
  //   out/homepage-2024-01-15T10-30-45-000Z.png
  const outPath = timestampedPath("./out", "homepage", "png");
  await screenshot(page, { path: outPath, fullPage: true });
  console.log("screenshot written to:", outPath);

  // ── Element-scoped screenshot ─────────────────────────────────────────────
  // screenshotElement resolves the selector and captures only that element.
  // Throws SelectorNotFoundError (retryable:false) if the selector misses.
  const heroBuf: Uint8Array = await screenshotElement(page, "#hero");
  console.log("hero element screenshot bytes:", heroBuf.byteLength);

  // Write an element screenshot directly to disk.
  await screenshotElement(page, "#hero", { path: "./hero.png" });
  console.log("hero screenshot written to ./hero.png");
}
