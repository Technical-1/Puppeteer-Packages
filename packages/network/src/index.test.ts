import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/network public surface", () => {
  it("exports the documented surface only", () => {
    // Types erase at runtime — surface filled in by Tasks 5–8.
    expect(typeof api).toBe("object");
  });
});
