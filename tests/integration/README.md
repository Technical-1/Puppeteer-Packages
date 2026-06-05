# @technical-1/integration-tests

Integration tier for the `@technical-1/*` Puppeteer monorepo. Runs real Chrome against a local HTTP fixture server.

## Running tests

**Server tests only (always run, no Chrome required):**

```bash
pnpm --filter @technical-1/integration-tests test
```

**Full integration tier (requires Chrome, gated by `PPTR_IT=1`):**

```bash
PPTR_IT=1 pnpm --filter @technical-1/integration-tests test
```

## Structure

- `fixtures/` — static HTML pages served by the local fixture server
- `src/server.ts` — tiny Node.js HTTP server that serves fixture pages and synthesizes `/download/sample.bin`
- `src/server.test.ts` — ungated unit tests for the fixture server (no Chrome needed)
- `src/*.test.ts` — browser-driving tests gated by `PPTR_IT=1` (Task 7)

## CI

The integration job sets `PPTR_IT=1` and runs this package's tests. All other CI jobs skip the browser tests automatically.
