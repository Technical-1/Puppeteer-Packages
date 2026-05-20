import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/pdf public surface", () => {
  it("exports exactly the documented surface", () => {
    expect(Object.keys(api).sort()).toEqual(["pageToPdf"].sort());
  });
});
