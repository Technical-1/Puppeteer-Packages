import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Integration tier is gated: in default `pnpm test` runs (PPTR_IT unset),
    // the browser tests (Task 7) SKIP via describe.skipIf. This server test is
    // NOT gated and always runs. CI sets PPTR_IT=1 in the integration job only.
    testTimeout: 60_000,
  },
});
