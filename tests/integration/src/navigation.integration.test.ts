import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { goto } from "@technical-1/navigation";
import { NavigationError } from "@technical-1/core";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("navigation integration", () => {
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
        (err: unknown) =>
          err instanceof NavigationError || (err instanceof Error && err.name === "NavigationError"),
      );
    } finally {
      await page.close();
    }
  });
});
