import { describe, it, expect, vi } from "vitest";
import type { Page, CoverageEntry, JSCoverageEntry } from "puppeteer-core";
import { collectCoverage } from "./collect.js";

interface MockCoverage {
  startJSCoverage: ReturnType<typeof vi.fn>;
  stopJSCoverage: ReturnType<typeof vi.fn>;
  startCSSCoverage: ReturnType<typeof vi.fn>;
  stopCSSCoverage: ReturnType<typeof vi.fn>;
}

function mockPage(cov: Partial<MockCoverage> = {}): { page: Page; cov: MockCoverage } {
  const coverage: MockCoverage = {
    startJSCoverage: vi.fn().mockResolvedValue(undefined),
    stopJSCoverage: vi.fn().mockResolvedValue([] as JSCoverageEntry[]),
    startCSSCoverage: vi.fn().mockResolvedValue(undefined),
    stopCSSCoverage: vi.fn().mockResolvedValue([] as CoverageEntry[]),
    ...cov,
  };
  return { page: { coverage } as unknown as Page, cov: coverage };
}

const jsEntry: JSCoverageEntry = {
  url: "https://x.test/app.js",
  text: "a".repeat(100),
  ranges: [{ start: 0, end: 60 }],
};
const cssEntry: CoverageEntry = {
  url: "https://x.test/app.css",
  text: "b".repeat(100),
  ranges: [{ start: 0, end: 20 }],
};

describe("collectCoverage — happy path (js + css)", () => {
  it("starts both domains, runs fn, stops both, and returns fn's result", async () => {
    const { page, cov } = mockPage({
      stopJSCoverage: vi.fn().mockResolvedValue([jsEntry]),
      stopCSSCoverage: vi.fn().mockResolvedValue([cssEntry]),
    });
    const fn = vi.fn().mockResolvedValue("RETURN");

    const out = await collectCoverage(page, fn);

    expect(cov.startJSCoverage).toHaveBeenCalledTimes(1);
    expect(cov.startCSSCoverage).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(page);
    expect(cov.stopJSCoverage).toHaveBeenCalledTimes(1);
    expect(cov.stopCSSCoverage).toHaveBeenCalledTimes(1);
    expect(out.result).toBe("RETURN");
  });

  it("starts coverage BEFORE running fn and stops AFTER", async () => {
    const order: string[] = [];
    const { page } = mockPage({
      startJSCoverage: vi.fn().mockImplementation(async () => void order.push("startJS")),
      startCSSCoverage: vi.fn().mockImplementation(async () => void order.push("startCSS")),
      stopJSCoverage: vi.fn().mockImplementation(async () => {
        order.push("stopJS");
        return [];
      }),
      stopCSSCoverage: vi.fn().mockImplementation(async () => {
        order.push("stopCSS");
        return [];
      }),
    });
    await collectCoverage(page, async () => void order.push("fn"));
    expect(order.indexOf("fn")).toBeGreaterThan(order.indexOf("startJS"));
    expect(order.indexOf("fn")).toBeGreaterThan(order.indexOf("startCSS"));
    expect(order.indexOf("fn")).toBeLessThan(order.indexOf("stopJS"));
    expect(order.indexOf("fn")).toBeLessThan(order.indexOf("stopCSS"));
  });

  it("reduces entries into per-file coverage and js/css/total summaries", async () => {
    const { page } = mockPage({
      stopJSCoverage: vi.fn().mockResolvedValue([jsEntry]),
      stopCSSCoverage: vi.fn().mockResolvedValue([cssEntry]),
    });
    const out = await collectCoverage(page, async () => 1);

    expect(out.files).toHaveLength(2);
    expect(out.js).toEqual({ totalBytes: 100, usedBytes: 60, unusedBytes: 40, usedRatio: 0.6 });
    expect(out.css).toEqual({ totalBytes: 100, usedBytes: 20, unusedBytes: 80, usedRatio: 0.2 });
    expect(out.total).toEqual({ totalBytes: 200, usedBytes: 80, unusedBytes: 120, usedRatio: 0.4 });
  });

  it("defaults resetOnNavigation to false for both start calls", async () => {
    const { page, cov } = mockPage();
    await collectCoverage(page, async () => 0);
    expect(cov.startJSCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ resetOnNavigation: false }),
    );
    expect(cov.startCSSCoverage).toHaveBeenCalledWith(
      expect.objectContaining({ resetOnNavigation: false }),
    );
  });

  it("emits DI logger step/success lines", async () => {
    const { page } = mockPage({
      stopJSCoverage: vi.fn().mockResolvedValue([jsEntry]),
      stopCSSCoverage: vi.fn().mockResolvedValue([cssEntry]),
    });
    const logger = { log: vi.fn() };
    await collectCoverage(page, async () => 0, { logger });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("starting coverage"), "step");
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("coverage collected"), "success");
  });
});

describe("collectCoverage — selective domains", () => {
  it("collects JS only: never touches the CSS coverage API", async () => {
    const { page, cov } = mockPage({ stopJSCoverage: vi.fn().mockResolvedValue([jsEntry]) });
    const out = await collectCoverage(page, async () => 0, { css: false });
    expect(cov.startJSCoverage).toHaveBeenCalledTimes(1);
    expect(cov.startCSSCoverage).not.toHaveBeenCalled();
    expect(cov.stopCSSCoverage).not.toHaveBeenCalled();
    expect(out.css).toEqual({ totalBytes: 0, usedBytes: 0, unusedBytes: 0, usedRatio: 0 });
    expect(out.files.every((f) => f.type === "js")).toBe(true);
  });

  it("collects CSS only: never touches the JS coverage API", async () => {
    const { page, cov } = mockPage({ stopCSSCoverage: vi.fn().mockResolvedValue([cssEntry]) });
    const out = await collectCoverage(page, async () => 0, { js: false });
    expect(cov.startCSSCoverage).toHaveBeenCalledTimes(1);
    expect(cov.startJSCoverage).not.toHaveBeenCalled();
    expect(cov.stopJSCoverage).not.toHaveBeenCalled();
    expect(out.js).toEqual({ totalBytes: 0, usedBytes: 0, unusedBytes: 0, usedRatio: 0 });
    expect(out.files.every((f) => f.type === "css")).toBe(true);
  });

  it("passes JS-only options through to startJSCoverage", async () => {
    const { page, cov } = mockPage();
    await collectCoverage(page, async () => 0, {
      css: false,
      resetOnNavigation: true,
      reportAnonymousScripts: true,
      includeRawScriptCoverage: true,
      useBlockCoverage: false,
    });
    expect(cov.startJSCoverage).toHaveBeenCalledWith({
      resetOnNavigation: true,
      reportAnonymousScripts: true,
      includeRawScriptCoverage: true,
      useBlockCoverage: false,
    });
  });
});

describe("collectCoverage — misuse & failures", () => {
  it("throws a NON-retryable ConfigError when both domains are disabled", async () => {
    const { page, cov } = mockPage();
    await expect(
      collectCoverage(page, async () => 0, { js: false, css: false }),
    ).rejects.toMatchObject({ name: "ConfigError", retryable: false });
    expect(cov.startJSCoverage).not.toHaveBeenCalled();
    expect(cov.startCSSCoverage).not.toHaveBeenCalled();
  });

  it("wraps a start failure as a retryable PptrKitError carrying the cause", async () => {
    const boom = new Error("Protocol error: Profiler.startPreciseCoverage");
    const { page } = mockPage({ startJSCoverage: vi.fn().mockRejectedValue(boom) });
    await expect(collectCoverage(page, async () => 0)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
  });

  it("wraps a stop failure as a retryable PptrKitError carrying the cause", async () => {
    const boom = new Error("target closed");
    const { page } = mockPage({ stopJSCoverage: vi.fn().mockRejectedValue(boom) });
    await expect(collectCoverage(page, async () => 0)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
  });
});

describe("collectCoverage — guaranteed stop", () => {
  it("stops both domains and RE-THROWS the caller error unwrapped when fn throws", async () => {
    const { page, cov } = mockPage();
    const err = new Error("caller boom");
    await expect(
      collectCoverage(page, async () => {
        throw err;
      }),
    ).rejects.toBe(err); // exact same error object, NOT wrapped
    expect(cov.stopJSCoverage).toHaveBeenCalledTimes(1);
    expect(cov.stopCSSCoverage).toHaveBeenCalledTimes(1);
  });

  it("swallows a teardown failure so the caller's original error still surfaces", async () => {
    const { page } = mockPage({
      stopJSCoverage: vi.fn().mockRejectedValue(new Error("stop failed during teardown")),
    });
    const err = new Error("caller boom");
    await expect(
      collectCoverage(page, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});
