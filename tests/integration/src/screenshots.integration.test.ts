import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { screenshot } from "@technical-1/screenshots";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("screenshots integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("screenshot returns a non-empty Uint8Array with PNG magic bytes", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const buf = await screenshot(page, { fullPage: true });

      // Guard length before indexed access (noUncheckedIndexedAccess).
      expect(buf.byteLength).toBeGreaterThanOrEqual(4);
      // PNG magic: 0x89 0x50 0x4E 0x47 — compare as a slice for a diff-friendly failure.
      expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    } finally {
      await page.close();
    }
  });
});
