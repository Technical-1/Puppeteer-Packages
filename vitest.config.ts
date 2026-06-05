import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "scripts/**/*.test.{js,ts}"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      // index.ts = pure re-export barrels; types.ts = declaration-only (no runtime).
      exclude: ["**/*.test.ts", "**/index.ts", "**/types.ts"],
      // Gate: fail the coverage run below these aggregate thresholds. Actual is
      // ~100% lines / ~98% branches; 90 leaves headroom for honest churn.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
