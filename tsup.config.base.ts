import { defineConfig, type Options } from "tsup";

/** Shared tsup options: ESM + CJS + .d.ts, tree-shakeable, no bundled deps. */
export function baseTsup(overrides: Options = {}): Options {
  return {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    target: "es2022",
    ...overrides,
  };
}

export default defineConfig(baseTsup());
