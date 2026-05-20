import { describe, it, expect, vi } from "vitest";
import { proxyArg, applyProxyAuth, ProxyRotator } from "./proxy.js";
import { ProxyError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

describe("proxyArg", () => {
  it("builds the --proxy-server arg from a url", () => {
    expect(proxyArg("http://1.2.3.4:8080")).toBe(
      "--proxy-server=http://1.2.3.4:8080",
    );
  });

  it("throws ProxyError for an empty/blank url", () => {
    expect(() => proxyArg("")).toThrow(ProxyError);
    expect(() => proxyArg("   ")).toThrow(ProxyError);
  });
});

describe("applyProxyAuth", () => {
  it("calls page.authenticate with the credentials", async () => {
    const page = {
      authenticate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    await applyProxyAuth(page, { username: "u", password: "p" });
    expect(page.authenticate).toHaveBeenCalledWith({
      username: "u",
      password: "p",
    });
  });
});

describe("ProxyRotator", () => {
  it("round-robins through the proxy pool", () => {
    const r = new ProxyRotator(["a", "b", "c"]);
    expect([r.next(), r.next(), r.next(), r.next()]).toEqual([
      "a",
      "b",
      "c",
      "a",
    ]);
  });

  it("throws ProxyError when constructed with an empty pool", () => {
    expect(() => new ProxyRotator([])).toThrow(ProxyError);
  });
});
