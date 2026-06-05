import { defineConfig, type Options } from "tsup";
import { resolve } from "node:path";
import { dedupInDist } from "./scripts/dedup-sourcemap.js";

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
    onSuccess: async () => {
      await dedupInDist(resolve(process.cwd(), "dist"));
    },
    ...overrides,
  };
}

export default defineConfig(baseTsup());
