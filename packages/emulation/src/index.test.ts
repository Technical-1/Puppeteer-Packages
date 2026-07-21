import { describe, it, expect } from "vitest";
import * as emulation from "./index.js";

describe("public surface", () => {
  it("exposes exactly the emulation functions", () => {
    expect(typeof emulation.emulateDevice).toBe("function");
    expect(typeof emulation.listKnownDevices).toBe("function");
    expect(typeof emulation.overridePermissions).toBe("function");
    expect(typeof emulation.setGeolocation).toBe("function");
    expect(typeof emulation.emulateMedia).toBe("function");
    expect(Object.keys(emulation).sort()).toEqual(
      [
        "emulateDevice",
        "listKnownDevices",
        "overridePermissions",
        "setGeolocation",
        "emulateMedia",
      ].sort(),
    );
  });
});
