import { describe, it, expect } from "vitest";
import * as human from "./index.js";

describe("public surface", () => {
  it("exposes humanDelay, humanType, humanMouseMove only", () => {
    expect(typeof human.humanDelay).toBe("function");
    expect(typeof human.humanType).toBe("function");
    expect(typeof human.humanMouseMove).toBe("function");
    expect(Object.keys(human).sort()).toEqual(
      ["humanDelay", "humanMouseMove", "humanType"].sort(),
    );
  });
});
