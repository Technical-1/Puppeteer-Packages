import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import {
  blockResources,
  unblockResources,
  captureResponses,
} from "@technical-1/network";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("network integration", () => {
  let executablePath: string;
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    executablePath = await ensureChrome();
    server = await startServer();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    await browser.close();
    await server.close();
  });

  it("blockResources aborts image requests (hero.png returns net::ERR_ABORTED)", async () => {
    const page = await browser.newPage();
    try {
      // Block all image resource types.
      await blockResources(page, ["image"]);

      const failedUrls: string[] = [];
      page.on("requestfailed", (req) => {
        failedUrls.push(req.url());
      });

      // image-page.html references /hero.png — should be aborted.
      await page.goto(`${server.baseUrl}/image-page.html`, {
        waitUntil: "domcontentloaded",
      });

      await unblockResources(page);

      const abortedImage = failedUrls.some((u) => u.includes("hero.png"));
      expect(abortedImage).toBe(true);
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
