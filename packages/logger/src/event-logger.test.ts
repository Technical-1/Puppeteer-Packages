import { describe, it, expect, vi } from "vitest";
import { createEventLogger } from "./event-logger.js";

describe("createEventLogger", () => {
  it("emits a log event with message and level", () => {
    const logger = createEventLogger();
    const handler = vi.fn();
    logger.on("log", handler);
    logger.log("hello", "step");
    expect(handler).toHaveBeenCalledWith({ message: "hello", level: "step" });
  });

  it("defaults an omitted level to info in the emitted event", () => {
    const logger = createEventLogger();
    const handler = vi.fn();
    logger.on("log", handler);
    logger.log("bare");
    expect(handler).toHaveBeenCalledWith({ message: "bare", level: "info" });
  });

  it("satisfies the core Logger shape (has a log method)", () => {
    const logger = createEventLogger();
    expect(typeof logger.log).toBe("function");
  });
});
