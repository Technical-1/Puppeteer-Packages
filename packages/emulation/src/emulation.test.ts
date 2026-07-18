import { describe, it, expect, vi } from "vitest";
import { emulateDevice } from "./emulation.js";
import { PptrKitError } from "@technical-1/core";
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
