import { describe, it, expect } from "vitest";
import * as emulation from "./index.js";

describe("public surface", () => {
  it("exposes emulateDevice and listKnownDevices only", () => {
    expect(typeof emulation.emulateDevice).toBe("function");
    expect(typeof emulation.listKnownDevices).toBe("function");
    expect(Object.keys(emulation).sort()).toEqual(
      ["emulateDevice", "listKnownDevices"].sort(),
    );
  });
});
