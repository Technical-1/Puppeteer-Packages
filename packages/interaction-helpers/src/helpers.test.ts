import { describe, it, expect, vi } from "vitest";
import { safeClick, safeType, waitAndGet, scroll } from "./helpers.js";
import { SelectorNotFoundError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    waitForSelector: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
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
    await expect(safeClick(page, "#missing")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
    await expect(safeClick(page, "#missing")).rejects.toMatchObject({
      selector: "#missing",
    });
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

  it("throws SelectorNotFoundError when the field is absent", async () => {
    const page = mockPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(safeType(page, "#x", "y")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
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
