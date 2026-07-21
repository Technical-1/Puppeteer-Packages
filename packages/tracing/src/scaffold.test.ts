import { describe, it, expect } from "vitest";
import { __tracingPackagePlaceholder } from "./index.js";

describe("scaffold", () => {
  it("package builds and imports", () => {
    expect(__tracingPackagePlaceholder).toBe(true);
  });
});
