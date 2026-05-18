import { describe, it, expect } from "vitest";
import * as logger from "./index.js";

describe("public surface", () => {
  it("exposes the two factories and the EventLogger class only", () => {
    expect(typeof logger.createConsoleLogger).toBe("function");
    expect(typeof logger.createEventLogger).toBe("function");
    expect(typeof logger.EventLogger).toBe("function");
    expect(Object.keys(logger).sort()).toEqual(
      ["EventLogger", "createConsoleLogger", "createEventLogger"].sort(),
    );
  });
});
