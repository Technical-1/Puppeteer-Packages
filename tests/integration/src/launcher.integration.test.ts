import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import { withBrowser } from "@technical-1/launcher";
import type { LaunchOptions } from "@technical-1/launcher";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("launcher integration", () => {
  let executablePath: string;
  let server: FixtureServer;

  beforeAll(async () => {
    executablePath = await ensureChrome();
    server = await startServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("withBrowser opens real Chrome, runs closure, closes cleanly; return value propagates", async () => {
    // Sandbox flags (--no-sandbox etc.) are injected by withBrowser internally, so they are intentionally NOT listed here.
    const opts: LaunchOptions = {
      executablePath,
      headless: true,
    };

    const result = await withBrowser(puppeteer, opts, async (browser) => {
      const page = await browser.newPage();
      await page.goto(server.baseUrl, { waitUntil: "domcontentloaded" });
      return page.title();
    });

    expect(result).toBe("Fixture Home");
  });
});
