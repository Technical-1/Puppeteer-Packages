import { describe, it, expect } from "vitest";
import { __contextsScaffold } from "./index.js";

describe("contexts scaffold", () => {
  it("loads the package entrypoint", () => {
    expect(__contextsScaffold).toBe(true);
  });
});
