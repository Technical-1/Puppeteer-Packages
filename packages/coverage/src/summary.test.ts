import { describe, it, expect } from "vitest";
import type { CoverageEntry } from "puppeteer-core";
import {
  usedBytesOf,
  complementRanges,
  fileCoverageOf,
  summarize,
} from "./summary.js";

describe("usedBytesOf", () => {
  it("sums (end - start) over ranges", () => {
    expect(usedBytesOf([{ start: 0, end: 10 }, { start: 20, end: 25 }])).toBe(15);
  });
  it("is 0 for no ranges", () => {
    expect(usedBytesOf([])).toBe(0);
  });
});

describe("complementRanges", () => {
  it("returns the gaps between used ranges within [0, length)", () => {
    expect(
      complementRanges([{ start: 10, end: 20 }, { start: 30, end: 40 }], 50),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
      { start: 40, end: 50 },
    ]);
  });
  it("returns the whole file when nothing is used", () => {
    expect(complementRanges([], 100)).toEqual([{ start: 0, end: 100 }]);
  });
  it("returns [] when the whole file is used", () => {
    expect(complementRanges([{ start: 0, end: 100 }], 100)).toEqual([]);
  });
  it("sorts and merges overlapping/out-of-order ranges before complementing", () => {
    expect(
      complementRanges([{ start: 30, end: 40 }, { start: 0, end: 35 }], 50),
    ).toEqual([{ start: 40, end: 50 }]);
  });
  it("clamps ranges that exceed the file length", () => {
    expect(complementRanges([{ start: 0, end: 999 }], 50)).toEqual([]);
  });
});

describe("fileCoverageOf", () => {
  it("computes total/used/unused bytes and both range sets", () => {
    const entry: CoverageEntry = {
      url: "https://x.test/app.js",
      text: "a".repeat(100),
      ranges: [{ start: 0, end: 40 }],
    };
    expect(fileCoverageOf(entry, "js")).toEqual({
      url: "https://x.test/app.js",
      type: "js",
      totalBytes: 100,
      usedBytes: 40,
      unusedBytes: 60,
      usedRanges: [{ start: 0, end: 40 }],
      unusedRanges: [{ start: 40, end: 100 }],
    });
  });
  it("handles a fully-unused file", () => {
    const entry: CoverageEntry = { url: "u", text: "xy", ranges: [] };
    const fc = fileCoverageOf(entry, "css");
    expect(fc.usedBytes).toBe(0);
    expect(fc.unusedBytes).toBe(2);
    expect(fc.unusedRanges).toEqual([{ start: 0, end: 2 }]);
  });
});

describe("summarize", () => {
  const files = [
    fileCoverageOf({ url: "a.js", text: "a".repeat(100), ranges: [{ start: 0, end: 50 }] }, "js"),
    fileCoverageOf({ url: "b.css", text: "b".repeat(100), ranges: [{ start: 0, end: 20 }] }, "css"),
  ];
  it("rolls up all files with a used ratio", () => {
    expect(summarize(files)).toEqual({
      totalBytes: 200,
      usedBytes: 70,
      unusedBytes: 130,
      usedRatio: 0.35,
    });
  });
  it("filters to a single domain when a type is passed", () => {
    expect(summarize(files, "js")).toEqual({
      totalBytes: 100,
      usedBytes: 50,
      unusedBytes: 50,
      usedRatio: 0.5,
    });
  });
  it("reports usedRatio 0 (not NaN) when there are no bytes", () => {
    expect(summarize([])).toEqual({
      totalBytes: 0,
      usedBytes: 0,
      unusedBytes: 0,
      usedRatio: 0,
    });
  });
});
