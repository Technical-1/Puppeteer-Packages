import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/session public surface", () => {
  it("exports the documented surface only", () => {
    // Types erase at runtime — surface is whatever Tasks 2/3 add. Placeholder
    // assertion replaced when those tasks land; the test exists from T1 so
    // every later task knows the barrel test is the gate.
    expect(typeof api).toBe("object");
  });
});
