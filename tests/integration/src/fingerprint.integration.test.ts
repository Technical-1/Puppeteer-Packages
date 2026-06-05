import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { applyFingerprint, randomFingerprint } from "@technical-1/fingerprint";
import { launchFixtureBrowser, teardownFixtureBrowser } from "./helpers.js";

declare var navigator: { language: string; userAgent: string };

describe.skipIf(process.env["PPTR_IT"] !== "1")("fingerprint integration", () => {
  let ctx: Awaited<ReturnType<typeof launchFixtureBrowser>>;
  beforeAll(async () => {
    ctx = await launchFixtureBrowser();
  });
  afterAll(async () => {
    await teardownFixtureBrowser(ctx);
  });

  it("reconciles the UA to the live browser and overrides navigator.language", async () => {
    const page = await ctx.browser.newPage();
    try {
      const fp = { ...randomFingerprint(() => 0), locale: "de-DE", timezoneId: "Europe/Berlin" };
      await applyFingerprint(page, fp);
      await page.goto(`${ctx.server.baseUrl}/`, { waitUntil: "load" });

      const liveMajor = (await ctx.browser.version()).match(/[\d.]+$/)?.[0]?.split(".")[0];
      const result = await page.evaluate(() => ({
        language: navigator.language,
        ua: navigator.userAgent,
      }));
      expect(result.language).toBe("de-DE");
      expect(result.ua).toContain(`Chrome/${liveMajor}`);
    } finally {
      await page.close();
    }
  });
});
