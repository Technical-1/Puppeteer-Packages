import { describe, it, expect, vi } from "vitest";
import type { Logger, LogLevel } from "./logger.js";
import type { LoggerOption, TimeoutOption } from "./types.js";
import { LOG_LEVELS } from "./logger.js";

describe("Logger contract", () => {
  it("LOG_LEVELS lists the supported levels in order", () => {
    expect(LOG_LEVELS).toEqual(["debug", "info", "step", "success", "warn", "error"]);
    expect(LOG_LEVELS).toHaveLength(6);
  });

  it("a conforming Logger receives message + level", () => {
    const log = vi.fn();
    const logger: Logger = { log };
    const level: LogLevel = "step";
    logger.log("hello", level);
    expect(log).toHaveBeenCalledWith("hello", "step");
    logger.log("bare message");
    expect(log).toHaveBeenLastCalledWith("bare message");
  });

  it("option shapes accept an injected logger and a timeout", () => {
    const opt: LoggerOption & TimeoutOption = { logger: { log: () => {} }, timeout: 5000 };
    expect(opt.timeout).toBe(5000);
    expect(typeof opt.logger?.log).toBe("function");
  });
});
