# @technical-1/retry

## 0.2.0

### Minor Changes

- 095f819: Unify the suite error taxonomy so every thrown failure is a discriminable
  `PptrKitError` subclass (cross-realm-safe `err.name`), not the generic base.

  - core: add `ConfigError`, `PoolError`, `DownloadError`, `NetworkError`, and
    `AbortError` (each terminal by default; `DownloadError`/`NetworkError` pass
    `retryable:true` explicitly at their transient sites).
  - config: missing-required-config now throws `ConfigError` (was base `PptrKitError`).
  - launcher: an invalid `BrowserPool` size now throws terminal `PoolError`.
  - downloads: snapshot/trigger/mid-poll failures throw `DownloadError`; the
    "no new file within Xms" poll timeout now throws the core `TimeoutError`.
  - network: empty-pattern, body-not-enabled, body-read, invalid-JSON, and
    throttle failures throw `NetworkError`.
  - retry: cancellation now throws `AbortError` (terminal) instead of a plain
    `Error("Aborted")`.
  - navigation: aborts are detected by `err.name === "AbortError"` (was a fragile
    `message.startsWith("Aborted")` match), and the shared control flow of `goto`
    and `navigateOnGesture` is extracted into one internal `runNavigation` helper.

  Migration: classify errors by the stable `err.name` / `err.retryable`
  properties (already the documented contract). Code matching the exact string
  `"PptrKitError"`, matching a cancelled navigation by `name === "Error"`, or
  catching a bare `Error` from an aborted retry must switch to the new names.

### Patch Changes

- 82642f7: Declare a supported Node floor (`engines.node >=18`, matching the puppeteer-core
  peer) on every package, and polish adoption docs: ESM-only notes on
  launcher/navigation/extract, a chrome-setup cross-link in the launcher
  quick-start, "TypeScript users only" @types/node wording in
  navigation/chrome-setup, and README nit fixes (autoScroll frame support,
  uploadFile parameter, network waiters import).
- Updated dependencies [82642f7]
- Updated dependencies [095f819]
  - @technical-1/core@0.2.0

## 0.1.0

### Minor Changes

- c9fcbac: Initial release of the utility tier: `withRetry` (backoff keyed off the core
  `retryable` contract), console + EventEmitter `Logger` implementations, and a
  typed env/options `loadConfig`.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
