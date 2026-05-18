import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsoleLogger } from "./console-logger.js";

let spies: Record<string, ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  spies = {
    debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
});
afterEach(() => vi.restoreAllMocks());

describe("createConsoleLogger", () => {
  it("routes levels to the matching console method", () => {
    const log = createConsoleLogger();
    log.log("d", "debug");
    log.log("i", "info");
    log.log("s", "step");
    log.log("ok", "success");
    log.log("w", "warn");
    log.log("e", "error");
    expect(spies.debug).toHaveBeenCalledWith("d");
    expect(spies.info).toHaveBeenCalledWith("i");
    expect(spies.info).toHaveBeenCalledWith("s");
    expect(spies.info).toHaveBeenCalledWith("ok");
    expect(spies.warn).toHaveBeenCalledWith("w");
    expect(spies.error).toHaveBeenCalledWith("e");
  });

  it("treats an omitted level as info", () => {
    createConsoleLogger().log("no level");
    expect(spies.info).toHaveBeenCalledWith("no level");
  });

  it("filters messages below minLevel", () => {
    const log = createConsoleLogger({ minLevel: "warn" });
    log.log("ignored", "info");
    log.log("kept", "error");
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledWith("kept");
    log.log("boundary", "warn");
    expect(spies.warn).toHaveBeenCalledWith("boundary"); // level == minLevel → kept
  });
});
