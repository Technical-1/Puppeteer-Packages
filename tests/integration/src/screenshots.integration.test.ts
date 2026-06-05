import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { screenshot } from "@technical-1/screenshots";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("screenshots integration", () => {
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

  it("screenshot returns a non-empty Uint8Array with PNG magic bytes", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const buf = await screenshot(page, { fullPage: true });

      expect(buf.byteLength).toBeGreaterThan(0);
      // PNG magic: 0x89 0x50 0x4E 0x47
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
    } finally {
      await page.close();
    }
  });
});
