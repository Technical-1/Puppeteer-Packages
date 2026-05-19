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

  it("is deterministic and picks index 0 with a zero seed", () => {
    const fp = randomFingerprint(() => 0);
    expect(fp).toEqual(randomFingerprint(() => 0));
    expect(fp.userAgent).toContain("Windows NT 10.0"); // first UA pool entry
    expect(fp.userAgent).toContain("Chrome/144.0.0.0");
    expect(fp.viewport).toEqual({ width: 1920, height: 1080 }); // first viewport
    expect(fp.locale).toBe("en-US");
    expect(fp.timezoneId).toBe("America/New_York");
  });

  it("clamps to the last pool entry when rand returns 1.0", () => {
    const fp = randomFingerprint(() => 1);
    expect(fp.userAgent).toContain("X11; Linux x86_64"); // last UA pool entry
    expect(fp.viewport).toEqual({ width: 1280, height: 800 }); // last viewport
    expect(fp.locale).toBe("fr-FR");
    expect(fp.timezoneId).toBe("Europe/Berlin");
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
    expect(page.setUserAgent).toHaveBeenCalledTimes(1);
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 });
    expect(page.setViewport).toHaveBeenCalledTimes(1);
    expect(page.emulateTimezone).toHaveBeenCalledWith("America/New_York");
    expect(page.emulateTimezone).toHaveBeenCalledTimes(1);
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "en-US,en;q=0.9",
    });
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledTimes(1);
  });
});
