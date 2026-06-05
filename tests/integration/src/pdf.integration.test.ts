import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { pageToPdf } from "@technical-1/pdf";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("pdf integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("pageToPdf returns a non-empty Uint8Array starting with %PDF- magic bytes", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const buf = await pageToPdf(page);

      // Guard length before indexed access (noUncheckedIndexedAccess).
      expect(buf.byteLength).toBeGreaterThanOrEqual(5);
      // PDF magic: "%PDF-" — decode first 5 bytes as latin1 for a diff-friendly failure.
      expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    } finally {
      await page.close();
    }
  });
});
