import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { safeType, safeClick, waitAndGet } from "@technical-1/interaction-helpers";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

// In-page globals used inside page.evaluate callbacks (runs inside Chromium, not Node.js).
declare var document: {
  querySelector(s: string): { value?: string; textContent: string | null } | null;
};

describe.skipIf(process.env["PPTR_IT"] !== "1")("interaction-helpers integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("safeType fills input; safeClick works on submit button; waitAndGet reads heading text", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/form.html`, { waitUntil: "domcontentloaded" });

      // Type into the name input and verify the value via evaluate.
      // page.evaluate runs a static function inside Chromium — not eval() on
      // external data. The selector is a hard-coded fixture constant.
      await safeType(page, "#name", "hello", { timeout: 10_000 });
      const value: unknown = await page.evaluate(() => {
        const el = document.querySelector("#name");
        return el?.value ?? "";
      });
      expect(value).toBe("hello");

      // safeClick on the submit button — no navigation; just assert it doesn't throw.
      await safeClick(page, "#submit", { timeout: 10_000 });

      // waitAndGet on the h1 heading.
      const heading = await waitAndGet(page, "h1", { timeout: 10_000 });
      expect(heading).toBe("Fixture Form");
    } finally {
      await page.close();
    }
  });
});
