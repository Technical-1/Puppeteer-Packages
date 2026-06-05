import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { pageToPdf } from "@technical-1/pdf";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("pdf integration", () => {
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

  it("pageToPdf returns a non-empty Uint8Array starting with %PDF- magic bytes", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.baseUrl}/`, { waitUntil: "domcontentloaded" });
      const buf = await pageToPdf(page);

      expect(buf.byteLength).toBeGreaterThan(0);
      // PDF magic bytes: 0x25 0x50 0x44 0x46 0x2D = "%PDF-"
      expect(buf[0]).toBe(0x25); // %
      expect(buf[1]).toBe(0x50); // P
      expect(buf[2]).toBe(0x44); // D
      expect(buf[3]).toBe(0x46); // F
      expect(buf[4]).toBe(0x2d); // -
    } finally {
      await page.close();
    }
  });
});
