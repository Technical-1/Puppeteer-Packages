import { describe, it, expect } from "vitest";
import * as tracing from "./index.js";

describe("public surface", () => {
  it("exposes traceRun only", () => {
    expect(typeof tracing.traceRun).toBe("function");
    expect(Object.keys(tracing).sort()).toEqual(["traceRun"].sort());
  });
});
