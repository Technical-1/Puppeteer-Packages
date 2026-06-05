import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { captureSession, restoreSession } from "@technical-1/session";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("session integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
  });

  it("captureSession + restoreSession round-trips cookies and localStorage", async () => {
    const page = await browser.newPage();
    try {
      // Navigate to the fixture origin so cookies are scoped correctly.
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });

      // Set a cookie and a localStorage key via CDP / evaluate.
      await page.browserContext().setCookie({
        name: "test-cookie",
        value: "cookie-value",
        domain: "127.0.0.1",
        path: "/",
      });
      await page.evaluate(() => {
        localStorage.setItem("test-key", "local-value");
      });

      // Capture the session snapshot.
      const snap = await captureSession(page);
      expect(snap.capturedAt).toBeTruthy();
      const cookieNames = snap.cookies.map((c) => c.name);
      expect(cookieNames).toContain("test-cookie");
      expect(snap.localStorage).toHaveProperty("test-key", "local-value");

      // Open a new page and restore the snapshot.
      const newPage = await browser.newPage();
      try {
        await restoreSession(newPage, snap);
        // Navigate to the same origin so evaluateOnNewDocument fires.
        await newPage.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });

        // Verify the localStorage key was restored.
        const restoredLocal = await newPage.evaluate(() =>
          localStorage.getItem("test-key"),
        );
        expect(restoredLocal).toBe("local-value");

        // Verify the cookie was restored.
        const restoredCookies = await newPage.browserContext().cookies();
        const restoredNames = restoredCookies.map((c) => c.name);
        expect(restoredNames).toContain("test-cookie");
      } finally {
        await newPage.close();
      }
    } finally {
      await page.close();
    }
  });
});
