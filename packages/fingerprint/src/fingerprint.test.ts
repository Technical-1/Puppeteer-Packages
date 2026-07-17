import { describe, it, expect, vi } from "vitest";
import {
  randomFingerprint,
  applyFingerprint,
  type Fingerprint,
} from "./fingerprint.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
    browser: () => ({ version: vi.fn().mockResolvedValue("HeadlessChrome/144.0.7559.96") }),
    ...overrides,
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
    expect(fp.timezoneId).toBe("Europe/Paris"); // coherent with fr-FR
  });

  it("always pairs locale and timezone from the same geo profile", () => {
    const coherent: Record<string, string> = {
      "en-US": "America/New_York",
      "en-GB": "Europe/London",
      "de-DE": "Europe/Berlin",
      "fr-FR": "Europe/Paris",
    };
    for (let i = 0; i < 200; i++) {
      const fp = randomFingerprint();
      expect(fp.timezoneId).toBe(coherent[fp.locale]);
    }
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
    // "UA/1.0" has no Chrome/ token, so reconcile leaves it unchanged
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

  it("reconciles the UA Chrome version to the live browser version", async () => {
    const page = mockPage({
      browser: () => ({ version: vi.fn().mockResolvedValue("HeadlessChrome/151.0.1.2") }),
    });
    const fp: Fingerprint = {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({
      userAgent: expect.stringContaining("Chrome/151.0.1.2"),
    });
  });

  it("falls back to the generated UA when the browser version is unparseable", async () => {
    const page = mockPage({
      browser: () => ({ version: vi.fn().mockResolvedValue("weird-no-version") }),
    });
    const fp: Fingerprint = {
      userAgent: "X Chrome/144.0.0.0 Y",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    expect(page.setUserAgent).toHaveBeenCalledWith({ userAgent: "X Chrome/144.0.0.0 Y" });
  });

  it("returns the UA unchanged when page.browser().version() throws", async () => {
    const page = mockPage({
      browser: () => ({
        version: vi.fn().mockRejectedValue(new Error("browser crashed")),
      }),
    });
    const fp: Fingerprint = {
      userAgent: "X Chrome/144.0.0.0 Y",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      timezoneId: "America/New_York",
    };
    await applyFingerprint(page, fp);
    // reconcileUserAgent catches the throw and returns the ua unmodified
    expect(page.setUserAgent).toHaveBeenCalledWith({ userAgent: "X Chrome/144.0.0.0 Y" });
  });

  it("uses locale without primary sub-tag as the sole language when locale has no dash", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "UA/1.0",
      viewport: { width: 1920, height: 1080 },
      locale: "fr",
      timezoneId: "Europe/Paris",
    };
    await applyFingerprint(page, fp);
    // locale "fr" has no "-", so primary is undefined → languages = ["fr"]
    expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      "fr",
      ["fr"],
    );
    // ACCEPT_LANGUAGE has no entry for "fr", so falls back to locale itself
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "fr",
    });
  });

  it("unions in the primary sub-tag for a hyphenated locale with no profile entry", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "UA/1.0",
      viewport: { width: 1920, height: 1080 },
      locale: "es-MX",
      timezoneId: "America/Mexico_City",
    };
    await applyFingerprint(page, fp);
    // ACCEPT_LANGUAGE has no entry for "es-MX", so header falls back to the locale itself...
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "es-MX",
    });
    // ...but navigator.languages must still union in the primary sub-tag "es",
    // matching the old-code fallback behavior for any pinned locale outside the profiles.
    expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      "es-MX",
      ["es-MX", "es"],
    );
  });

  it("overrides in-page navigator.language and languages coherently with the Accept-Language header", async () => {
    const page = mockPage();
    const fp: Fingerprint = {
      userAgent: "X Chrome/144.0.0.0 Y",
      viewport: { width: 1280, height: 800 },
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
    };
    await applyFingerprint(page, fp);
    // header is "de-DE,de;q=0.9,en;q=0.8" → languages must advertise the same en fallback
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    });
    expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      "de-DE",
      ["de-DE", "de", "en"],
    );
  });
});
