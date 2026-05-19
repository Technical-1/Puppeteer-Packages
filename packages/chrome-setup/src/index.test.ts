import { describe, it, expect } from "vitest";
import * as cs from "./index.js";

describe("public surface", () => {
  it("exposes the resolve/download/ensure fns + the build constant only", () => {
    expect(typeof cs.resolveChromePath).toBe("function");
    expect(typeof cs.downloadChrome).toBe("function");
    expect(typeof cs.ensureChrome).toBe("function");
    expect(typeof cs.DEFAULT_CHROME_BUILD).toBe("string");
    expect(Object.keys(cs).sort()).toEqual(
      ["DEFAULT_CHROME_BUILD", "downloadChrome", "ensureChrome", "resolveChromePath"].sort(),
    );
  });
});
