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

  it("delivers each log to every subscribed listener", () => {
    const logger = createEventLogger();
    const h1 = vi.fn();
    const h2 = vi.fn();
    logger.on("log", h1);
    logger.on("log", h2);
    logger.log("broadcast", "info");
    expect(h1).toHaveBeenCalledWith({ message: "broadcast", level: "info" });
    expect(h2).toHaveBeenCalledWith({ message: "broadcast", level: "info" });
  });
});
