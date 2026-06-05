import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enableDownloads, awaitDownload } from "@technical-1/downloads";
import { ensureChrome } from "@technical-1/chrome-setup";
import { startServer } from "./server.js";
import type { FixtureServer } from "./server.js";

describe.skipIf(process.env["PPTR_IT"] !== "1")("downloads integration", () => {
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

  it("awaitDownload resolves with filename=sample.bin and size=1024", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "pptr-dl-"));
    const page = await browser.newPage();
    try {
      await enableDownloads(browser, tmpDir);
      await page.goto(`${server.baseUrl}/download-link.html`, {
        waitUntil: "domcontentloaded",
      });

      const result = await awaitDownload(
        tmpDir,
        async () => {
          await page.click("#dl");
        },
        { timeoutMs: 30_000, pollMs: 100 },
      );

      expect(result.filename).toBe("sample.bin");
      expect(result.size).toBe(1024);
    } finally {
      await page.close();
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
