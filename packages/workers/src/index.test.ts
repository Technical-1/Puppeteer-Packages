import { describe, it, expect } from "vitest";
import * as workers from "./index.js";

describe("public surface", () => {
  it("exposes exactly the three runtime functions", () => {
    expect(typeof workers.listWorkers).toBe("function");
    expect(typeof workers.evaluateInWorker).toBe("function");
    expect(typeof workers.observeWorkers).toBe("function");
    expect(Object.keys(workers).sort()).toEqual(
      ["evaluateInWorker", "listWorkers", "observeWorkers"].sort(),
    );
  });
});
