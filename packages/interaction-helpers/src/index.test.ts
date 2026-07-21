import { describe, it, expect } from "vitest";
import * as ih from "./index.js";

describe("public surface", () => {
  it("exposes all interaction helpers", () => {
    const fns = [
      "safeClick",
      "safeType",
      "waitAndGet",
      "scroll",
      "autoScroll",
      "resolveFrame",
      "uploadFile",
      "uploadViaFileChooser",
      "pressKey",
      "pressShortcut",
      "waitForFunction",
      "readClipboard",
      "writeClipboard",
    ] as const;
    for (const name of fns) {
      expect(typeof (ih as Record<string, unknown>)[name]).toBe("function");
    }
    expect(Object.keys(ih).sort()).toEqual([...fns].sort());
  });
});
