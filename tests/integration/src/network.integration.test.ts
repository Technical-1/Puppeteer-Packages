import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import {
  blockResources,
  unblockResources,
  captureResponses,
} from "@technical-1/network";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

// In-page globals used inside page.evaluate callbacks (runs inside Chromium, not Node.js).
declare var document: {
  querySelector(sel: string): { complete: boolean; naturalWidth: number } | null;
};

describe.skipIf(process.env["PPTR_IT"] !== "1")("network integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("blockResources aborts image requests (hero.png returns net::ERR_ABORTED)", async () => {
    const page = await browser.newPage();
    try {
      // Block all image resource types before navigation.
      await blockResources(page, ["image"]);

      // networkidle0 ensures all pending sub-resources have been attempted
      // (and aborted) before we inspect the page state.
      await page.goto(`${server.baseUrl}/image-page.html`, {
        waitUntil: "networkidle0",
        timeout: 15_000,
      });

      await unblockResources(page);

      // Verify the OUTCOME of blocking: the <img> element exists in the DOM
      // but its request was aborted by blockResources, so the image never
      // loaded — img.complete is true (no longer pending) and naturalWidth
      // is 0 (no pixel data was received). This assertion is hollow-proof:
      // if blockResources is disabled the image loads successfully and
      // naturalWidth becomes > 0, causing the test to fail.
      const imageBlocked = await page.evaluate(() => {
        const img = document.querySelector("img");
        return img !== null && img.complete === true && img.naturalWidth === 0;
      });
      expect(imageBlocked).toBe(true);
    } finally {
      await page.close();
    }
  });

  it("captureResponses records the main document response after navigation", async () => {
    const page = await browser.newPage();
    try {
      const collector = await captureResponses(page);

      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      collector.stop();

      expect(collector.responses.length).toBeGreaterThan(0);

      const docResponse = collector.responses.find(
        (r) => r.resourceType === "document",
      );
      expect(docResponse).toBeDefined();
      expect(docResponse?.status).toBe(200);
    } finally {
      await page.close();
    }
  });
});
