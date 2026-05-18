import { describe, it, expect } from "vitest";
import * as retry from "./index.js";

describe("public surface", () => {
  it("exposes exactly withRetry as the runtime export", () => {
    expect(typeof retry.withRetry).toBe("function");
    expect(Object.keys(retry).sort()).toEqual(["withRetry"].sort());
  });
});
