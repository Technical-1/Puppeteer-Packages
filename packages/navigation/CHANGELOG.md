# @technical-1/navigation

## 1.0.0

### Major Changes

- Graduate the suite to its first stable release. All packages move to 1.0.0 with a committed, semver-stable public API: browser launch and a race-free pool, navigation with typed retries and gesture-triggered waits, data extraction, iframe-aware interaction, file upload, infinite scroll, keyboard shortcuts, device/viewport emulation, multi-tab/popup coordination, dialog handling, response capture and predicate event waits, session persistence, anti-detection building blocks, screenshots, PDF, downloads, and a captcha adapter interface — all sharing a typed, cross-realm-safe error hierarchy and a bring-your-own-logger contract, with puppeteer-core as a bounded peer dependency.

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

- b1e38f1: Add `navigateOnGesture(page, gesture, opts)` for gesture-triggered navigation:
  races `page.waitForNavigation` against the gesture under the same per-attempt
  timeout + `withRetry` wrapping as `goto`, returning `HTTPResponse | null` and
  wrapping surviving failures as a core `NavigationError`.

  `waitForNetworkIdle` now accepts a `logger` (its options extend `LoggerOption`),
  emits `step`/`error` log lines, and wraps a network-idle timeout as a core
  `TimeoutError` (retryable) instead of leaking puppeteer-core's own error.

  `goto` no longer rewraps a caller-cancelled navigation (aborted `retry.signal`)
  as a retryable `NavigationError` — the abort passes through as a terminal error.

### Patch Changes

- 82642f7: Declare a supported Node floor (`engines.node >=18`, matching the puppeteer-core
  peer) on every package, and polish adoption docs: ESM-only notes on
  launcher/navigation/extract, a chrome-setup cross-link in the launcher
  quick-start, "TypeScript users only" @types/node wording in
  navigation/chrome-setup, and README nit fixes (autoScroll frame support,
  uploadFile parameter, network waiters import).
- Updated dependencies [82642f7]
- Updated dependencies [095f819]
- Updated dependencies
  - @technical-1/core@1.0.0
  - @technical-1/retry@1.0.0

## 0.1.0

### Minor Changes

- 6cbd672: Navigation & data tier: `interaction-helpers` (hardened
  `safeClick`/`safeType`/`waitAndGet`/`scroll` throwing typed core errors),
  `navigation` (`goto` with retry + `waitForNetworkIdle`), and `extract`
  (`extractText`/`extractAll`/`extractTable`/`extractSchema` DOM extraction).
  All declare `puppeteer-core` as a peer. `navigation` is the first capability
  package to depend on an internal utility (`@technical-1/retry`) in addition to
  `core`. `extract` is standalone — no `@technical-1/core` dependency (returns
  `""`/`[]`, never throws typed errors).
- 55c0e59: `goto` now returns the `HTTPResponse | null` from the navigation so callers can
  gate on HTTP status. `RetryOptions` is re-exported from the package barrel.

### Patch Changes

- Updated dependencies [1bbfebd]
- Updated dependencies [c9fcbac]
  - @technical-1/core@0.1.0
  - @technical-1/retry@0.1.0
