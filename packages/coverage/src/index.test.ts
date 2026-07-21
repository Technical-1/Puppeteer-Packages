import { describe, it, expect } from "vitest";
import * as coverage from "./index.js";

describe("public surface", () => {
  it("exposes collectCoverage as the only runtime export", () => {
    expect(typeof coverage.collectCoverage).toBe("function");
    expect(Object.keys(coverage).sort()).toEqual(["collectCoverage"]);
  });
});
