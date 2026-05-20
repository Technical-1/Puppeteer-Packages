import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/session public surface", () => {
  it("exports exactly the documented surface", () => {
    // Types erase at runtime — only runtime values appear here.
    expect(Object.keys(api).sort()).toEqual(
      ["Session", "captureSession", "restoreSession"].sort(),
    );
  });
});
