import { describe, it, expect } from "vitest";
import * as config from "./index.js";

describe("public surface", () => {
  it("exposes exactly loadConfig as the runtime export", () => {
    expect(typeof config.loadConfig).toBe("function");
    expect(Object.keys(config).sort()).toEqual(["loadConfig"].sort());
  });
});
