import { describe, it, expect } from "vitest";
import { timestampedPath } from "./timestamp.js";

describe("timestampedPath", () => {
  it("produces a filename-safe ISO-8601 path with the given base and ext", () => {
    const p = timestampedPath("/out", "homepage", "png");
    // Format: /out/homepage-YYYY-MM-DDTHH-MM-SS-mmmZ.png
    expect(p).toMatch(/^\/out\/homepage-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/);
  });

  it("defaults ext to 'png'", () => {
    expect(timestampedPath("/out", "x")).toMatch(/\.png$/);
  });

  it("uses an injected clock for deterministic tests", () => {
    const fixed = new Date("2026-05-20T14:30:00.123Z");
    expect(timestampedPath("/out", "x", "jpg", () => fixed)).toBe(
      "/out/x-2026-05-20T14-30-00-123Z.jpg",
    );
  });
});
