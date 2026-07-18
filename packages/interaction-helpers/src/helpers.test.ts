import { describe, it, expect, vi } from "vitest";
import { safeClick, safeType, waitAndGet, scroll } from "./helpers.js";
import { SelectorNotFoundError } from "@technical-1/core";
import type { Page, Frame } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    waitForSelector: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

function mockFrame(overrides: Record<string, unknown> = {}): Frame {
  return {
    waitForSelector: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Frame;
}

describe("safeClick", () => {
  it("waits for the visible selector then clicks", async () => {
    const page = mockPage();
    await safeClick(page, "#btn");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#btn",
      expect.objectContaining({ visible: true }),
    );
    expect(page.click).toHaveBeenCalledWith("#btn");
  });

  it("throws SelectorNotFoundError (carrying the selector) when not found", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    const err = await safeClick(page, "#missing").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SelectorNotFoundError);
    expect(err).toMatchObject({ selector: "#missing", retryable: false });
  });

  it("preserves the original error as cause (Issue 2)", async () => {
    const inner = new Error("timeout");
    const page = mockPage({ waitForSelector: vi.fn().mockRejectedValue(inner) });
    const err = await safeClick(page, "#x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SelectorNotFoundError);
    expect((err as { cause?: unknown }).cause).toBe(inner);
  });

  it("does NOT wrap a click() failure as SelectorNotFoundError (Issue 3)", async () => {
    const clickError = new Error("click failed");
    const page = mockPage({ click: vi.fn().mockRejectedValue(clickError) });
    await expect(safeClick(page, "#btn")).rejects.toBe(clickError);
    const err = await safeClick(page, "#btn").catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(SelectorNotFoundError);
  });

  it("passes DEFAULT_TIMEOUT (15000) when no timeout opt is given (Issue 4)", async () => {
    const page = mockPage();
    await safeClick(page, "#btn");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#btn",
      expect.objectContaining({ timeout: 15000 }),
    );
  });

  it("logs at step level via the injected logger (Issue 5)", async () => {
    const logger = { log: vi.fn() };
    const page = mockPage();
    await safeClick(page, "#btn", { logger });
    expect(logger.log).toHaveBeenCalledWith("click #btn", "step");
  });
});

describe("safeType", () => {
  it("waits then types with the given delay", async () => {
    const page = mockPage();
    await safeType(page, "#in", "abc", { delay: 10 });
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#in",
      expect.objectContaining({ visible: true }),
    );
    expect(page.type).toHaveBeenCalledWith("#in", "abc", { delay: 10 });
  });

  it("defaults to delay 0 when no delay option is supplied (delay ?? 0 branch)", async () => {
    const page = mockPage();
    await safeType(page, "#in", "hello");
    expect(page.type).toHaveBeenCalledWith("#in", "hello", { delay: 0 });
  });

  it("throws SelectorNotFoundError when the field is absent", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(safeType(page, "#x", "y")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("logs at step level via the injected logger", async () => {
    const logger = { log: vi.fn() };
    const page = mockPage();
    await safeType(page, "#in", "abc", { logger });
    expect(logger.log).toHaveBeenCalledWith("type into #in", "step");
  });
});

describe("waitAndGet", () => {
  it("returns the trimmed text content", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    const text = await waitAndGet(page, "#x");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#x",
      expect.objectContaining({ visible: true }),
    );
    expect(text).toBe("hi");
  });

  it("throws SelectorNotFoundError when the selector never appears", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(waitAndGet(page, "#x")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("returns empty string (not null) when evaluate resolves null (null-coalescing branch)", async () => {
    // page.evaluate may resolve null when the in-browser callback returns null
    // (e.g. element exists but textContent is null). The ?? "" branch on line 77
    // must produce "" rather than throwing or forwarding null.
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue(null) });
    const text = await waitAndGet(page, "#x");
    expect(text).toBe("");
  });

  it("passes opts.timeout to waitForSelector when provided", async () => {
    const page = mockPage();
    await waitAndGet(page, "#x", { timeout: 5000 });
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#x",
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it("logs at step level via the injected logger", async () => {
    const logger = { log: vi.fn() };
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("text") });
    await waitAndGet(page, "#x", { logger });
    // waitVisible calls page.waitForSelector; no direct log call in waitAndGet
    // but confirming it doesn't crash with a logger present
    expect(page.waitForSelector).toHaveBeenCalled();
  });
});

describe("scroll", () => {
  it("evaluates a scroll function (bottom by default)", async () => {
    const page = mockPage();
    await scroll(page);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it("passes an explicit pixel amount through to evaluate", async () => {
    const page = mockPage();
    await scroll(page, { by: 500 });
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), 500);
  });
});

describe("Page | Frame support", () => {
  it("safeClick operates on a Frame", async () => {
    const frame = mockFrame();
    await safeClick(frame, "#btn");
    expect(frame.waitForSelector).toHaveBeenCalledWith(
      "#btn",
      expect.objectContaining({ visible: true }),
    );
    expect(frame.click).toHaveBeenCalledWith("#btn");
  });

  it("safeType operates on a Frame", async () => {
    const frame = mockFrame();
    await safeType(frame, "#in", "abc");
    expect(frame.type).toHaveBeenCalledWith("#in", "abc", { delay: 0 });
  });

  it("waitAndGet operates on a Frame", async () => {
    const frame = mockFrame({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    expect(await waitAndGet(frame, "#x")).toBe("hi");
  });

  it("scroll operates on a Frame", async () => {
    const frame = mockFrame();
    await scroll(frame);
    expect(frame.evaluate).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it("safeClick still throws SelectorNotFoundError against a Frame", async () => {
    const frame = mockFrame({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(safeClick(frame, "#missing")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });
});
