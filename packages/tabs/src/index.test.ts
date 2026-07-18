import { describe, it, expect } from "vitest";
import * as tabs from "./index.js";

describe("public surface", () => {
  it("exposes waitForNewPage and waitForPageMatching only", () => {
    expect(typeof tabs.waitForNewPage).toBe("function");
    expect(typeof tabs.waitForPageMatching).toBe("function");
    expect(Object.keys(tabs).sort()).toEqual(
      ["waitForNewPage", "waitForPageMatching"].sort(),
    );
  });
});
