import { describe, it, expect, vi } from "vitest";
import { emulateDevice, listKnownDevices, overridePermissions, setGeolocation } from "./emulation.js";
import { PptrKitError } from "@technical-1/core";
import { KnownDevices } from "puppeteer-core";
import type { BrowserContext, Page } from "puppeteer-core";

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    emulate: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

describe("emulateDevice — arbitrary viewport", () => {
  it("applies a full mobile viewport via setViewport and never calls emulate", async () => {
    const page = mockPage();
    await emulateDevice(page, {
      width: 400,
      height: 800,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false,
    });
    expect(page.setViewport).toHaveBeenCalledWith({
      width: 400,
      height: 800,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false,
    });
    expect(page.setViewport).toHaveBeenCalledTimes(1);
    expect(page.emulate).not.toHaveBeenCalled();
  });

  it("applies a bare desktop viewport ({width,height}) via setViewport", async () => {
    const page = mockPage();
    await emulateDevice(page, { width: 1280, height: 720 });
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
    expect(page.emulate).not.toHaveBeenCalled();
  });

  it("emits DI logger step/success lines around the viewport apply", async () => {
    const page = mockPage();
    const logger = { log: vi.fn() };
    await emulateDevice(page, { width: 800, height: 600 }, { logger });
    expect(logger.log).toHaveBeenCalledWith("setting viewport 800x600", "step");
    expect(logger.log).toHaveBeenCalledWith("viewport set 800x600", "success");
  });

  it("wraps a setViewport failure as retryable PptrKitError with cause", async () => {
    const boom = new Error("target closed");
    const page = mockPage({ setViewport: vi.fn().mockRejectedValue(boom) });
    await expect(emulateDevice(page, { width: 800, height: 600 })).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
    await expect(emulateDevice(page, { width: 800, height: 600 })).rejects.toBeInstanceOf(
      PptrKitError,
    );
  });
});

describe("emulateDevice — custom Device", () => {
  const device = {
    userAgent: "Mozilla/5.0 (custom) Chrome/144.0.0.0",
    viewport: { width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  };

  it("applies a Device via page.emulate and never calls setViewport", async () => {
    const page = mockPage();
    await emulateDevice(page, device);
    expect(page.emulate).toHaveBeenCalledWith(device);
    expect(page.emulate).toHaveBeenCalledTimes(1);
    expect(page.setViewport).not.toHaveBeenCalled();
  });

  it("emits DI logger step/success lines for a custom device", async () => {
    const page = mockPage();
    const logger = { log: vi.fn() };
    await emulateDevice(page, device, { logger });
    expect(logger.log).toHaveBeenCalledWith("emulating custom device", "step");
    expect(logger.log).toHaveBeenCalledWith("emulated custom device", "success");
  });

  it("wraps a page.emulate failure as retryable PptrKitError with cause", async () => {
    const boom = new Error("session detached");
    const page = mockPage({ emulate: vi.fn().mockRejectedValue(boom) });
    await expect(emulateDevice(page, device)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
  });
});

describe("emulateDevice — KnownDevices preset", () => {
  it("applies a named preset via page.emulate with the catalog's Device object", async () => {
    const page = mockPage();
    await emulateDevice(page, "iPhone 15 Pro");
    expect(page.emulate).toHaveBeenCalledWith(KnownDevices["iPhone 15 Pro"]);
    expect(page.emulate).toHaveBeenCalledTimes(1);
    expect(page.setViewport).not.toHaveBeenCalled();
  });

  it("emits DI logger step/success lines naming the preset", async () => {
    const page = mockPage();
    const logger = { log: vi.fn() };
    await emulateDevice(page, "iPhone 15 Pro", { logger });
    expect(logger.log).toHaveBeenCalledWith("emulating device preset iPhone 15 Pro", "step");
    expect(logger.log).toHaveBeenCalledWith("emulated device preset iPhone 15 Pro", "success");
  });

  it("throws a NON-retryable PptrKitError for an unknown preset name", async () => {
    const page = mockPage();
    await expect(
      // deliberately unknown name — cast through unknown to bypass the KnownDeviceName type
      emulateDevice(page, "Nokia 3310" as unknown as Parameters<typeof emulateDevice>[1]),
    ).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: false,
      context: { device: "Nokia 3310" },
    });
    expect(page.emulate).not.toHaveBeenCalled();
    expect(page.setViewport).not.toHaveBeenCalled();
  });

  it("wraps a page.emulate failure on a preset as retryable PptrKitError", async () => {
    const boom = new Error("target closed");
    const page = mockPage({ emulate: vi.fn().mockRejectedValue(boom) });
    await expect(emulateDevice(page, "iPhone 15 Pro")).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
  });
});

describe("listKnownDevices", () => {
  it("returns the installed puppeteer-core preset names, including a well-known one", () => {
    const names = listKnownDevices();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("iPhone 15 Pro");
    expect(names).toEqual(Object.keys(KnownDevices));
  });
});

function mockContext(overrides: Record<string, unknown> = {}): BrowserContext {
  return {
    overridePermissions: vi.fn().mockResolvedValue(undefined),
    clearPermissionOverrides: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as BrowserContext;
}

function pageWithContext(ctx: BrowserContext, url = "https://example.com/app"): Page {
  return {
    browserContext: vi.fn().mockReturnValue(ctx),
    url: vi.fn().mockReturnValue(url),
  } as unknown as Page;
}

describe("overridePermissions", () => {
  it("grants the listed permissions on a BrowserContext for the given origin", async () => {
    const ctx = mockContext();
    await overridePermissions(ctx, ["camera", "microphone"], {
      origin: "https://example.com",
    });
    expect(ctx.overridePermissions).toHaveBeenCalledWith("https://example.com", [
      "camera",
      "microphone",
    ]);
    expect(ctx.overridePermissions).toHaveBeenCalledTimes(1);
  });

  it("resolves the context from a Page and defaults origin to the page origin", async () => {
    const ctx = mockContext();
    const page = pageWithContext(ctx, "https://shop.example.com/cart?x=1");
    await overridePermissions(page, ["geolocation"]);
    expect(page.browserContext).toHaveBeenCalledTimes(1);
    expect(ctx.overridePermissions).toHaveBeenCalledWith(
      "https://shop.example.com",
      ["geolocation"],
    );
  });

  it("uses an explicit origin over the page origin when both are available", async () => {
    const ctx = mockContext();
    const page = pageWithContext(ctx, "https://a.example.com/");
    await overridePermissions(page, ["notifications"], { origin: "https://b.example.com" });
    expect(ctx.overridePermissions).toHaveBeenCalledWith("https://b.example.com", [
      "notifications",
    ]);
  });

  it("emits DI logger step/success lines", async () => {
    const ctx = mockContext();
    const logger = { log: vi.fn() };
    await overridePermissions(ctx, ["clipboard-read"], {
      origin: "https://example.com",
      logger,
    });
    expect(logger.log).toHaveBeenCalledWith(
      "granting 1 permission(s) for https://example.com",
      "step",
    );
    expect(logger.log).toHaveBeenCalledWith(
      "granted 1 permission(s) for https://example.com",
      "success",
    );
  });

  it("throws ConfigError (non-retryable) for an empty permission list", async () => {
    const ctx = mockContext();
    await expect(
      overridePermissions(ctx, [], { origin: "https://example.com" }),
    ).rejects.toMatchObject({ name: "ConfigError", retryable: false });
    expect(ctx.overridePermissions).not.toHaveBeenCalled();
  });

  it("throws ConfigError when a BrowserContext is passed without an origin", async () => {
    const ctx = mockContext();
    await expect(overridePermissions(ctx, ["camera"])).rejects.toMatchObject({
      name: "ConfigError",
      retryable: false,
    });
    expect(ctx.overridePermissions).not.toHaveBeenCalled();
  });

  it("throws ConfigError when the page origin cannot be derived (about:blank)", async () => {
    const ctx = mockContext();
    const page = pageWithContext(ctx, "about:blank");
    await expect(overridePermissions(page, ["camera"])).rejects.toMatchObject({
      name: "ConfigError",
      retryable: false,
    });
    expect(ctx.overridePermissions).not.toHaveBeenCalled();
  });

  it("wraps an overridePermissions rejection as retryable PptrKitError with cause", async () => {
    const boom = new Error("target closed");
    const ctx = mockContext({ overridePermissions: vi.fn().mockRejectedValue(boom) });
    await expect(
      overridePermissions(ctx, ["camera"], { origin: "https://example.com" }),
    ).rejects.toMatchObject({ name: "PptrKitError", retryable: true, cause: boom });
  });
});

function geoPage(ctx?: BrowserContext, url = "https://maps.example.com/"): Page {
  return {
    setGeolocation: vi.fn().mockResolvedValue(undefined),
    browserContext: vi.fn().mockReturnValue(ctx ?? mockContext()),
    url: vi.fn().mockReturnValue(url),
  } as unknown as Page;
}

describe("setGeolocation", () => {
  it("sets the coordinates via page.setGeolocation", async () => {
    const page = geoPage();
    await setGeolocation(page, { latitude: 59.95, longitude: 30.31667, accuracy: 10 });
    expect(page.setGeolocation).toHaveBeenCalledWith({
      latitude: 59.95,
      longitude: 30.31667,
      accuracy: 10,
    });
    expect(page.setGeolocation).toHaveBeenCalledTimes(1);
  });

  it("omits accuracy when not provided", async () => {
    const page = geoPage();
    await setGeolocation(page, { latitude: 0, longitude: 0 });
    expect(page.setGeolocation).toHaveBeenCalledWith({ latitude: 0, longitude: 0 });
  });

  it("emits DI logger step/success lines", async () => {
    const page = geoPage();
    const logger = { log: vi.fn() };
    await setGeolocation(page, { latitude: 12.5, longitude: -70.1 }, { logger });
    expect(logger.log).toHaveBeenCalledWith("setting geolocation 12.5,-70.1", "step");
    expect(logger.log).toHaveBeenCalledWith("geolocation set 12.5,-70.1", "success");
  });

  it("grants the geolocation permission first when grantPermission is true", async () => {
    const ctx = mockContext();
    const page = geoPage(ctx, "https://maps.example.com/here");
    await setGeolocation(page, { latitude: 1, longitude: 2 }, { grantPermission: true });
    expect(ctx.overridePermissions).toHaveBeenCalledWith("https://maps.example.com", [
      "geolocation",
    ]);
    // permission granted before coordinates are set
    const grantOrder = (ctx.overridePermissions as unknown as { mock: { invocationCallOrder: number[] } })
      .mock.invocationCallOrder[0]!;
    const setOrder = (page.setGeolocation as unknown as { mock: { invocationCallOrder: number[] } })
      .mock.invocationCallOrder[0]!;
    expect(grantOrder).toBeLessThan(setOrder);
  });

  it("does not grant any permission when grantPermission is false/omitted", async () => {
    const ctx = mockContext();
    const page = geoPage(ctx);
    await setGeolocation(page, { latitude: 1, longitude: 2 });
    expect(ctx.overridePermissions).not.toHaveBeenCalled();
  });

  it.each([
    ["latitude too high", { latitude: 91, longitude: 0 }],
    ["latitude too low", { latitude: -91, longitude: 0 }],
    ["longitude too high", { latitude: 0, longitude: 181 }],
    ["longitude too low", { latitude: 0, longitude: -181 }],
    ["negative accuracy", { latitude: 0, longitude: 0, accuracy: -1 }],
    ["NaN latitude", { latitude: Number.NaN, longitude: 0 }],
  ])("throws ConfigError for %s", async (_label, coords) => {
    const page = geoPage();
    await expect(setGeolocation(page, coords)).rejects.toMatchObject({
      name: "ConfigError",
      retryable: false,
    });
    expect(page.setGeolocation).not.toHaveBeenCalled();
  });

  it("wraps a setGeolocation rejection as retryable PptrKitError with cause", async () => {
    const boom = new Error("session detached");
    const page = geoPage();
    (page.setGeolocation as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(boom);
    await expect(setGeolocation(page, { latitude: 1, longitude: 2 })).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
  });
});
