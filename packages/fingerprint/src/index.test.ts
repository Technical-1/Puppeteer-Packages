import { describe, it, expect } from "vitest";
import * as fp from "./index.js";

describe("public surface", () => {
  it("exposes randomFingerprint and applyFingerprint only", () => {
    expect(typeof fp.randomFingerprint).toBe("function");
    expect(typeof fp.applyFingerprint).toBe("function");
    expect(Object.keys(fp).sort()).toEqual(
      ["applyFingerprint", "randomFingerprint"].sort(),
    );
  });
});
