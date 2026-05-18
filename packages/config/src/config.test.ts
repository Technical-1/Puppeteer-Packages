import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";
import { PptrKitError } from "@technical-1/core";

describe("loadConfig", () => {
  it("uses defaults when env vars are unset", () => {
    const cfg = loadConfig(
      { headless: { env: "X_HEADLESS", default: true } },
      {},
    );
    expect(cfg.headless).toBe(true);
  });

  it("reads from env and applies parse", () => {
    const cfg = loadConfig(
      { headless: { env: "X_HEADLESS", default: true, parse: (v) => v !== "false" } },
      { X_HEADLESS: "false" },
    );
    expect(cfg.headless).toBe(false);
  });

  it("returns the raw string when no parser is given", () => {
    const cfg = loadConfig({ key: { env: "X_KEY" } }, { X_KEY: "abc" });
    expect(cfg.key).toBe("abc");
  });

  it("throws a PptrKitError naming the env var when a required key is missing", () => {
    try {
      loadConfig({ key: { env: "X_KEY", required: true } }, {});
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PptrKitError);
      expect((err as PptrKitError).message).toContain("X_KEY");
      expect((err as PptrKitError).context).toEqual({ env: "X_KEY" });
    }
  });
});
