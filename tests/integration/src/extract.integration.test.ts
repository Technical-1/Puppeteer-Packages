import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { extractText, extractAll } from "@technical-1/extract";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("extract integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("extractText returns the h1 text from index.html", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const text = await extractText(page, "#title");
      expect(text).toBe("Fixture Home");
    } finally {
      await page.close();
    }
  });

  it("extractAll returns list of matching elements", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      // index.html has two inline elements with text: the h1 and a#nav and button#trigger.
      // Select the anchor and button to get a predictable list.
      const items = await extractAll(page, "body a, body button");
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items).toContain("Go to form");
      expect(items).toContain("Trigger");
    } finally {
      await page.close();
    }
  });
});
