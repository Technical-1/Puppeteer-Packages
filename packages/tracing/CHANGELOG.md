# @technical-1/tracing

## 1.1.0

### Minor Changes

- 8626fe6: Add `@technical-1/tracing`: DevTools performance tracing for Puppeteer pages.
  `traceRun(page, fn, options?)` starts a trace (`categories` / `screenshots` / `path`
  options), runs your function, and **always** stops the trace in a `finally` — returning
  the captured buffer (`Uint8Array`) with your function's value, and optionally writing the
  trace JSON to `path` via puppeteer-core. If `fn` throws, the trace is still stopped and the
  original error is re-thrown (never masked by a stop-time failure). Failures throw typed
  `PptrKitError`s (`retryable: true`; discriminate by `err.name`), and an optional DI logger
  reports lifecycle steps. `puppeteer-core` stays a type-only peer dependency (`>=22 <25`).

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
