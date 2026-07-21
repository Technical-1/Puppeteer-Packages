# @technical-1/tracing

DevTools performance tracing for a Puppeteer `Page` — `traceRun` starts a trace, runs your
function, and **always** stops it, returning the captured buffer alongside your function's
value. You inject the `Page` (type-only `puppeteer-core` peer). Errors are typed
`PptrKitError`s from `@technical-1/core`; pass an optional DI `logger`.

```ts
import { traceRun } from "@technical-1/tracing";

const { value, trace } = await traceRun(page, async (p) => {
  await p.goto("https://example.com", { waitUntil: "networkidle0" });
  return p.title();
});

console.log(`${value} — captured ${trace.length} bytes of trace data`);

// Optionally have puppeteer-core write the trace JSON to disk as well:
const { path } = await traceRun(
  page,
  (p) => p.goto("https://example.com"),
  { path: "./trace.json", categories: ["devtools.timeline"], screenshots: true }
);
console.log(`trace also written to ${path}`);
```

## Behavior

`traceRun(page, fn, options?)` calls `page.tracing.start(...)`, runs `fn(page)`, and
**always stops** the trace via a guaranteed `finally`-style unwind — the captured buffer
(`Uint8Array`) is returned alongside `fn`'s value. When `options.path` is set, it's handed
straight through to puppeteer-core's `tracing.start`, which owns the file write; this
package never touches the filesystem itself. Only one trace can be active per browser at a
time, so nested `traceRun` calls sharing a browser will fail at `start` (wrapped as a
retryable `PptrKitError`).

## Errors

- **`start` failure** — `page.tracing.start` rejects → `PptrKitError` (`retryable: true`,
  original error attached as `cause`).
- **`fn` failure** — the trace is still stopped, then the **original error is re-thrown
  unwrapped**; a stop-time failure during this unwind never masks it (reported via the
  logger only, if provided).
- **`stop` failure** (`fn` succeeded) — `page.tracing.stop` rejects → `PptrKitError`
  (`retryable: true`, original error attached as `cause`).
- **`stop` returns `undefined`** — `PptrKitError` (`retryable: true`).

All thrown errors are typed `PptrKitError`s — discriminate with `err.name === "PptrKitError"`,
never `instanceof` (safe across module-realm/duplicate-package boundaries).

## Install

```sh
pnpm add @technical-1/tracing puppeteer-core
```

`puppeteer-core` is a **type-only** peer dependency (`>=22 <25`) — it supplies the `Page`
type used at compile time; this package never imports it at runtime.
