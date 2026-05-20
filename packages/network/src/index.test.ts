import { describe, it, expect } from "vitest";
import * as api from "./index.js";

describe("@technical-1/network public surface", () => {
  it("exports exactly the documented surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "THROTTLE_PROFILES",
        "blockResources",
        "captureResponses",
        "setOffline",
        "throttle",
        "unblockResources",
      ].sort(),
    );
  });
});
