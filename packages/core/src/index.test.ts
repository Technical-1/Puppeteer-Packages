import { describe, it, expect } from "vitest";
import * as core from "./index.js";

describe("public surface", () => {
  it("re-exports the error hierarchy, Logger constants, and is otherwise minimal", () => {
    expect(typeof core.PptrKitError).toBe("function");
    expect(typeof core.SelectorNotFoundError).toBe("function");
    expect(typeof core.NavigationError).toBe("function");
    expect(typeof core.TimeoutError).toBe("function");
    expect(typeof core.CaptchaError).toBe("function");
    expect(typeof core.ProxyError).toBe("function");
    expect(typeof core.SessionError).toBe("function");
    expect(core.LOG_LEVELS).toContain("error");
  });

  it("exposes exactly the intended runtime (value) exports — no more, no less", () => {
    expect(Object.keys(core).sort()).toEqual(
      [
        "CaptchaError",
        "LOG_LEVELS",
        "NavigationError",
        "PptrKitError",
        "ProxyError",
        "SelectorNotFoundError",
        "SessionError",
        "TimeoutError",
      ].sort(),
    );
  });
});
