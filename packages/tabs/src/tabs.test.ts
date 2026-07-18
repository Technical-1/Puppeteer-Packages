import { describe, expect, it } from "vitest";
import { TABS_SCAFFOLD_VERSION } from "./tabs.js";

describe("tabs scaffold", () => {
  it("exports the placeholder scaffold marker", () => {
    expect(TABS_SCAFFOLD_VERSION).toBe("0.0.0");
  });
});
