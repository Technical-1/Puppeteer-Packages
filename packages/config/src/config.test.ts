import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";
import { ConfigError } from "@technical-1/core";

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

  it("throws a ConfigError naming the env var when a required key is missing", () => {
    try {
      loadConfig({ key: { env: "X_KEY", required: true } }, {});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).name).toBe("ConfigError");
      expect((err as ConfigError).retryable).toBe(false);
      expect((err as ConfigError).message).toContain("X_KEY");
      expect((err as ConfigError).context).toEqual({ env: "X_KEY" });
    }
  });

  it("treats an empty-string env var as missing for a required field", () => {
    expect(() =>
      loadConfig({ key: { env: "X_KEY", required: true } }, { X_KEY: "" }),
    ).toThrow(ConfigError);
  });

  it("uses the default (no throw) when a field is both required and has a default", () => {
    const cfg = loadConfig(
      { key: { env: "X_KEY", required: true, default: "fallback" } },
      {},
    );
    expect(cfg.key).toBe("fallback");
  });

  it("keeps a falsy default when the env var is absent", () => {
    const cfg = loadConfig(
      {
        flag: { env: "X_FLAG", default: false },
        count: { env: "X_COUNT", default: 0 },
        name: { env: "X_NAME", default: "" },
      },
      {},
    );
    expect(cfg.flag).toBe(false);
    expect(cfg.count).toBe(0);
    expect(cfg.name).toBe("");
  });

  it("yields undefined (no throw) for an optional field with no default and no env var", () => {
    const cfg = loadConfig({ opt: { env: "X_OPT" } }, {});
    expect(cfg.opt).toBeUndefined();
  });

  it("types a parsed optional field with no default as V | undefined", () => {
    const cfg = loadConfig({ port: { env: "PORT", parse: Number } }, {});
    // runtime: absent, no default → undefined
    expect(cfg.port).toBeUndefined();
    // type: must be number | undefined, so a bare number assignment must be rejected
    // @ts-expect-error port is number | undefined here, not number
    const n: number = cfg.port;
    void n;
  });
});
