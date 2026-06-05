import { describe, it, expect, expectTypeOf } from "vitest";
import * as nav from "./index.js";
import type { RetryOptions } from "./index.js";

describe("public surface", () => {
  it("exposes goto and waitForNetworkIdle only", () => {
    expect(typeof nav.goto).toBe("function");
    expect(typeof nav.waitForNetworkIdle).toBe("function");
    expect(Object.keys(nav).sort()).toEqual(
      ["goto", "waitForNetworkIdle"].sort(),
    );
  });
});

describe("navigation barrel re-exports", () => {
  it("re-exports RetryOptions (reachable via GotoOptions.retry)", () => {
    expectTypeOf<RetryOptions>().toHaveProperty("retries");
  });
});
