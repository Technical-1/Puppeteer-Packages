import { describe, it, expect } from "vitest";
import * as contexts from "./index.js";

describe("public surface", () => {
  it("exposes exactly the five context functions", () => {
    expect(typeof contexts.createIsolatedContext).toBe("function");
    expect(typeof contexts.withContext).toBe("function");
    expect(typeof contexts.listContextTargets).toBe("function");
    expect(typeof contexts.overridePermissions).toBe("function");
    expect(typeof contexts.clearContextPermissions).toBe("function");
    expect(Object.keys(contexts).sort()).toEqual(
      [
        "clearContextPermissions",
        "createIsolatedContext",
        "listContextTargets",
        "overridePermissions",
        "withContext",
      ].sort(),
    );
  });
});
