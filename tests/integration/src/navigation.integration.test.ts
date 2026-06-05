import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { goto } from "@technical-1/navigation";
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

  // NOTE: goto's failure path (wrapping page.goto rejections as NavigationError,
  // incl. retry/terminal cases) is covered deterministically by the navigation
  // unit tests (packages/navigation/src/navigation.test.ts) with a mocked page.
  // It is intentionally NOT asserted here: a real browser's behavior on a FAILED
  // navigation is environment-dependent (in CI sandboxes a refused/aborted
  // navigation can hang past page.goto's own timeout), which makes it flaky.
  // Integration tests cover real-Chrome happy paths; error-wrapping is unit-tested.
});
