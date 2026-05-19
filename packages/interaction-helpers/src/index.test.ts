import { describe, it, expect } from "vitest";
import * as ih from "./index.js";

describe("public surface", () => {
  it("exposes the four helpers only", () => {
    expect(typeof ih.safeClick).toBe("function");
    expect(typeof ih.safeType).toBe("function");
    expect(typeof ih.waitAndGet).toBe("function");
    expect(typeof ih.scroll).toBe("function");
    expect(Object.keys(ih).sort()).toEqual(
      ["safeClick", "safeType", "scroll", "waitAndGet"].sort(),
    );
  });
});
