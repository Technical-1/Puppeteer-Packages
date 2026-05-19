import { describe, it, expect, vi } from "vitest";
import {
  randomFingerprint,
  applyFingerprint,
  type Fingerprint,
} from "./fingerprint.js";
import type { Page } from "puppeteer-core";

function mockPage(): Page {
  return {
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("randomFingerprint", () => {
  it("returns a well-formed fingerprint from the curated pools", () => {
    const fp = randomFingerprint();
    expect(typeof fp.userAgent).toBe("string");
    expect(fp.userAgent.length).toBeGreaterThan(0);
    expect(fp.viewport.width).toBeGreaterThan(0);
    expect(fp.viewport.height).toBeGreaterThan(0);
    expect(typeof fp.locale).toBe("string");
    expect(typeof fp.timezoneId).toBe("string");
  });

  it("is deterministic when given a seeded picker", () => {
    const fp = randomFingerprint(() => 0);
    const fp2 = randomFingerprint(() => 0);
    expect(fp).toEqual(fp2);
  });
});

describe("applyFingerprint", () => {
  it("applies UA (object form), viewport, timezone and Accept-Language", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "UA/1.0",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({ userAgent: "UA/1.0" });
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 });
    expect(page.emulateTimezone).toHaveBeenCalledWith("America/New_York");
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "en-US",
    });
  });
});
