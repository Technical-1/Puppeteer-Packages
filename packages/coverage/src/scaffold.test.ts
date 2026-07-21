import { describe, it, expect } from "vitest";
import { __coverageScaffold } from "./index.js";

describe("scaffold", () => {
  it("loads", () => {
    expect(__coverageScaffold).toBe(true);
  });
});
