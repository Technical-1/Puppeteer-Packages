import { describe, it, expect } from "vitest";
import * as nav from "./index.js";

describe("public surface", () => {
  it("exposes goto and waitForNetworkIdle only", () => {
    expect(typeof nav.goto).toBe("function");
    expect(typeof nav.waitForNetworkIdle).toBe("function");
    expect(Object.keys(nav).sort()).toEqual(
      ["goto", "waitForNetworkIdle"].sort(),
    );
  });
});
