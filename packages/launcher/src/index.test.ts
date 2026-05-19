import { describe, it, expect } from "vitest";
import * as launcher from "./index.js";

describe("public surface", () => {
  it("exposes launch, withBrowser and BrowserPool only", () => {
    expect(typeof launcher.launch).toBe("function");
    expect(typeof launcher.withBrowser).toBe("function");
    expect(typeof launcher.BrowserPool).toBe("function");
    expect(Object.keys(launcher).sort()).toEqual(
      ["BrowserPool", "launch", "withBrowser"].sort(),
    );
  });
});
