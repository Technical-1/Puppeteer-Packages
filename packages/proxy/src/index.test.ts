import { describe, it, expect } from "vitest";
import * as proxy from "./index.js";

describe("public surface", () => {
  it("exposes proxyArg, applyProxyAuth, ProxyRotator only", () => {
    expect(typeof proxy.proxyArg).toBe("function");
    expect(typeof proxy.applyProxyAuth).toBe("function");
    expect(typeof proxy.ProxyRotator).toBe("function");
    expect(Object.keys(proxy).sort()).toEqual(
      ["ProxyRotator", "applyProxyAuth", "proxyArg"].sort(),
    );
  });
});
