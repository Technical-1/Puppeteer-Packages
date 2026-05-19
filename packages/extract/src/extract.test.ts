import { describe, it, expect, vi } from "vitest";
import {
  extractText,
  extractAll,
  extractTable,
  extractSchema,
} from "./extract.js";
import type { Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    evaluate: vi.fn(),
    ...overrides,
  } as unknown as Page;
}

describe("extractText", () => {
  it("returns trimmed text for a present selector", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("  hi  ") });
    expect(await extractText(page, "h1")).toBe("hi");
  });

  it("returns empty string when the selector is absent", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue("") });
    expect(await extractText(page, "h1")).toBe("");
  });
});

describe("extractAll", () => {
  it("returns trimmed text of every match", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([" a ", "b "]) });
    expect(await extractAll(page, ".x")).toEqual(["a", "b"]);
  });

  it("returns [] when nothing matches", async () => {
    const page = mockPage({ evaluate: vi.fn().mockResolvedValue([]) });
    expect(await extractAll(page, ".x")).toEqual([]);
  });
});

describe("extractTable", () => {
  it("returns a 2D array of trimmed cell text", async () => {
    const page = mockPage({
      evaluate: vi.fn().mockResolvedValue([
        ["1", "2"],
        ["3", "4"],
      ]),
    });
    expect(await extractTable(page, "table")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("extractSchema", () => {
  it("maps each field selector to its trimmed text ('' when absent)", async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce(" Widget ")
      .mockResolvedValueOnce("");
    const page = mockPage({ evaluate });
    const row = await extractSchema(page, { name: ".name", price: ".price" });
    expect(row).toEqual({ name: "Widget", price: "" });
  });
});
