import { describe, it, expect } from "vitest";
import * as cdp from "./index.js";

describe("public surface", () => {
  it("exposes openCdpSession and withCdpSession only", () => {
    expect(typeof cdp.openCdpSession).toBe("function");
    expect(typeof cdp.withCdpSession).toBe("function");
    expect(Object.keys(cdp).sort()).toEqual(
      ["openCdpSession", "withCdpSession"].sort(),
    );
  });
});
