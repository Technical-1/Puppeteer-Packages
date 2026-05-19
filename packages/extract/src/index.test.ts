import { describe, it, expect } from "vitest";
import * as ex from "./index.js";

describe("public surface", () => {
  it("exposes the four extraction fns only", () => {
    expect(typeof ex.extractText).toBe("function");
    expect(typeof ex.extractAll).toBe("function");
    expect(typeof ex.extractTable).toBe("function");
    expect(typeof ex.extractSchema).toBe("function");
    expect(Object.keys(ex).sort()).toEqual(
      ["extractAll", "extractSchema", "extractTable", "extractText"].sort(),
    );
  });
});
