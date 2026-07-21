import { describe, it, expect, vi } from "vitest";
import type { Browser, BrowserContext } from "puppeteer-core";
import { createIsolatedContext } from "./context.js";

/** Minimal BrowserContext stub. */
function contextMock(over: Partial<Record<string, unknown>> = {}): BrowserContext {
  return {
    overridePermissions: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    targets: vi.fn().mockReturnValue([]),
    clearPermissionOverrides: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as BrowserContext;
}

/** Browser stub whose createBrowserContext yields `ctx`. */
function browserMock(ctx: BrowserContext): {
  browser: Browser;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue(ctx);
  const browser = { createBrowserContext: create } as unknown as Browser;
  return { browser, create };
}

describe("createIsolatedContext", () => {
  it("creates a context with no options", async () => {
    const ctx = contextMock();
    const { browser, create } = browserMock(ctx);
    const result = await createIsolatedContext(browser);
    expect(result).toBe(ctx);
    expect(create).toHaveBeenCalledWith({});
  });

  it("passes proxyServer and proxyBypassList through", async () => {
    const ctx = contextMock();
    const { browser, create } = browserMock(ctx);
    await createIsolatedContext(browser, {
      proxyServer: "http://host:8080",
      proxyBypassList: ["localhost"],
    });
    expect(create).toHaveBeenCalledWith({
      proxyServer: "http://host:8080",
      proxyBypassList: ["localhost"],
    });
  });

  it("applies each permission grant in order", async () => {
    const ctx = contextMock();
    const { browser } = browserMock(ctx);
    await createIsolatedContext(browser, {
      permissions: [
        { origin: "https://a.com", permissions: ["geolocation"] },
        { origin: "https://b.com", permissions: ["notifications"] },
      ],
    });
    expect(ctx.overridePermissions).toHaveBeenNthCalledWith(
      1, "https://a.com", ["geolocation"],
    );
    expect(ctx.overridePermissions).toHaveBeenNthCalledWith(
      2, "https://b.com", ["notifications"],
    );
  });

  it("wraps a createBrowserContext rejection as retryable ContextError", async () => {
    const create = vi.fn().mockRejectedValue(new Error("cdp down"));
    const browser = { createBrowserContext: create } as unknown as Browser;
    await expect(
      createIsolatedContext(browser, { proxyServer: "http://h:1" }),
    ).rejects.toMatchObject({
      name: "ContextError",
      retryable: true,
      context: { proxyServer: "http://h:1" },
    });
  });

  it("closes the context and throws when a permission grant fails", async () => {
    const ctx = contextMock({
      overridePermissions: vi.fn().mockRejectedValue(new Error("bad perm")),
    });
    const { browser } = browserMock(ctx);
    await expect(
      createIsolatedContext(browser, {
        permissions: [{ origin: "https://a.com", permissions: ["geolocation"] }],
      }),
    ).rejects.toMatchObject({
      name: "ContextError",
      retryable: true,
      context: { origin: "https://a.com" },
    });
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  it("logs step then success through the injected logger", async () => {
    const ctx = contextMock();
    const { browser } = browserMock(ctx);
    const log = vi.fn();
    await createIsolatedContext(browser, { logger: { log } });
    expect(log).toHaveBeenCalledWith("contexts: creating isolated context", "step");
    expect(log).toHaveBeenCalledWith(
      "contexts: isolated context created (0 permission grants)",
      "success",
    );
  });
});
