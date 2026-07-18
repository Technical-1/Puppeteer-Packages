import { describe, it, expect, vi } from "vitest";
import { pressKey, pressShortcut } from "./keyboard.js";
import type { Page } from "puppeteer-core";

function mockKeyPage(overrides: Record<string, unknown> = {}): Page {
  return {
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  } as unknown as Page;
}

describe("pressKey", () => {
  it("presses a single key", async () => {
    const page = mockKeyPage();
    await pressKey(page, "Enter");
    expect(page.keyboard.press).toHaveBeenCalledWith("Enter");
  });

  it("logs a step line", async () => {
    const logger = { log: vi.fn() };
    await pressKey(mockKeyPage(), "Escape", { logger });
    expect(logger.log).toHaveBeenCalledWith("press Escape", "step");
  });
});

describe("pressShortcut", () => {
  it("holds modifiers, presses the key, then releases in reverse", async () => {
    const page = mockKeyPage();
    await pressShortcut(page, ["Control", "Shift"], "KeyA");
    expect(page.keyboard.down).toHaveBeenNthCalledWith(1, "Control");
    expect(page.keyboard.down).toHaveBeenNthCalledWith(2, "Shift");
    expect(page.keyboard.press).toHaveBeenCalledWith("KeyA");
    expect(page.keyboard.up).toHaveBeenNthCalledWith(1, "Shift");
    expect(page.keyboard.up).toHaveBeenNthCalledWith(2, "Control");
  });

  it("accepts a single (non-array) modifier and logs the combo", async () => {
    const logger = { log: vi.fn() };
    const page = mockKeyPage();
    await pressShortcut(page, "Meta", "KeyV", { logger });
    expect(page.keyboard.down).toHaveBeenCalledWith("Meta");
    expect(page.keyboard.up).toHaveBeenCalledWith("Meta");
    expect(logger.log).toHaveBeenCalledWith("shortcut Meta+KeyV", "step");
  });

  it("releases modifiers even if the key press throws (finally branch)", async () => {
    const boom = new Error("press failed");
    const page = mockKeyPage({
      keyboard: {
        press: vi.fn().mockRejectedValue(boom),
        down: vi.fn().mockResolvedValue(undefined),
        up: vi.fn().mockResolvedValue(undefined),
      },
    });
    await expect(pressShortcut(page, "Control", "KeyC")).rejects.toBe(boom);
    expect(page.keyboard.up).toHaveBeenCalledWith("Control");
  });
});
