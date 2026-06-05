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
      const res = await goto(page, `${server.baseUrl}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10_000,
      });
      expect(res).not.toBeNull();
      expect(res?.status()).toBe(200);
      const title = await page.title();
      expect(title).toBe("Fixture Home");
    } finally {
      await page.close();
    }
  });

  it("goto with a failing navigation and low retries throws NavigationError", async () => {
    const page = await browser.newPage();
    try {
      // Deterministically force a navigation network failure via request
      // interception (abort the request) — no dependence on real-network
      // connection-refusal timing, which is flaky in CI sandboxes.
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        req.abort().catch(() => {});
      });
      await expect(
        goto(page, "http://example.invalid/", {
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
