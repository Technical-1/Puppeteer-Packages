import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import {
  blockResources,
  unblockResources,
  captureResponses,
} from "@technical-1/network";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

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
      // Block all image resource types.
      await blockResources(page, ["image"]);

      // Track image requests via the `request` event — more reliable than
      // `requestfailed` which may not fire for interceptor-aborted requests.
      const interceptedImageUrls: string[] = [];
      page.on("request", (req) => {
        if (req.resourceType() === "image") {
          interceptedImageUrls.push(req.url());
        }
      });

      // networkidle0 ensures the image request has been issued (and aborted)
      // before we check — domcontentloaded would resolve before the <img> fires.
      await page.goto(`${server.baseUrl}/image-page.html`, {
        waitUntil: "networkidle0",
        timeout: 15_000,
      });

      await unblockResources(page);

      // Print the actual intercepted URLs on failure so the diff is informative.
      expect(interceptedImageUrls.join(", ")).toContain("hero.png");
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
