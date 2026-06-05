import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { goto } from "@technical-1/navigation";
import { NavigationError } from "@technical-1/core";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("navigation integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("goto navigates to fixture index.html and page contains known element", async () => {
    const page = await browser.newPage();
    try {
      await goto(page, `${server.baseUrl}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10_000,
      });
      const title = await page.title();
      expect(title).toBe("Fixture Home");
    } finally {
      await page.close();
    }
  });

  it("goto with bad URL and low retries throws NavigationError", async () => {
    const page = await browser.newPage();
    try {
      // Port 1 on 127.0.0.1 should always refuse connections.
      await expect(
        goto(page, "http://127.0.0.1:1/", {
          waitUntil: "domcontentloaded",
          timeout: 2_000,
          retry: { retries: 1, minDelayMs: 50, maxDelayMs: 100 },
        }),
      ).rejects.toSatisfy(
        // instanceof covers the normal case; name-branch guards cross-realm
        // robustness when the error crosses a dual ESM/CJS module boundary.
        (err: unknown) =>
          err instanceof NavigationError || (err instanceof Error && err.name === "NavigationError"),
      );
    } finally {
      await page.close();
    }
  });
});
