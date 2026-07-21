import { describe, it, expect } from "vitest";
import * as authFlow from "./index.js";

describe("scaffold", () => {
  it("module loads", () => {
    expect(authFlow).toBeTypeOf("object");
  });
});
