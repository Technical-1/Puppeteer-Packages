import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer-core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enableDownloads, awaitDownload } from "@technical-1/downloads";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";
import type { FixtureServer } from "./server.js";

// NOTE: `enableDownloads` configures the SHARED browser's CDP session download
// directory. Adding a second download test would require resetting that dir
// between tests. For simplicity this suite intentionally has a single download
// test; the per-test tmpDir is cleaned in the finally block.
describe.skipIf(process.env["PPTR_IT"] !== "1")("downloads integration", () => {
  let server: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    ({ browser, server } = await launchFixtureBrowser());
  });

  afterAll(async () => {
    await teardownFixtureBrowser({ browser, server });
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
