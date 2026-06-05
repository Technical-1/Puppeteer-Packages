import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Integration tier is gated: in default `pnpm test` runs (PPTR_IT unset),
    // the browser tests (Task 7) SKIP via describe.skipIf. This server test is
    // NOT gated and always runs. CI sets PPTR_IT=1 in the integration job only.
    testTimeout: 60_000,
    // hookTimeout must accommodate a cold-cache Chrome download in beforeAll:
    // ensureChrome() can fetch ~200 MB of Chrome-for-Testing on the first CI
    // run (new branch or cache eviction), which takes 30–45 s on typical
    // runners — well beyond Vitest's 10 s default.
    hookTimeout: 120_000,
  },
});
