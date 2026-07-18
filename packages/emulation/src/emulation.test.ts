import { describe, it, expect, vi } from "vitest";
import { emulateDevice } from "./emulation.js";
import { PptrKitError } from "@technical-1/core";
import { KnownDevices } from "puppeteer-core";
import type { Page } from "puppeteer-core";

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
