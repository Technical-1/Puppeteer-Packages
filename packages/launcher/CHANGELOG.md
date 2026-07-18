# @technical-1/launcher

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
- 3792835: Fix pre-1.0 quality defects across eight packages:

  - session (minor, breaking): `SessionSnapshot` now records a required `origin` field, and `restoreSession`'s injected script skips writing storage on any non-matching origin — callers hand-constructing snapshots must supply `origin`.
  - screenshots (minor, breaking): `screenshot`/`screenshotElement` options are now typed as `Omit<ScreenshotOptions, 'encoding'>` so the `Uint8Array` return type is honest — passing `encoding` no longer type-checks.
  - config (minor, breaking): `loadConfig`'s return type now surfaces optional fields with no default as `V | undefined` instead of falsely claiming presence — code that assumed presence gets a compile error.
  - network (patch): `throttle`/`setOffline` reuse one cached CDP session per page instead of leaking a new session on every call.
  - downloads (patch): mid-poll `readdir`/`stat` failures surface as a retryable `PptrKitError` instead of a raw Node error.
  - fingerprint (patch): `navigator.languages` is derived from the `Accept-Language` header token list, so JS reads match the header (no en-fallback mismatch).
  - launcher (patch): `BrowserPool` throws a terminal `PptrKitError` when constructed with a non-positive/non-integer size instead of deadlocking `acquire()`.
  - captcha (patch): `injectToken` sets `.value` and dispatches `input`/`change` for input/textarea fields so Turnstile's hidden input is actually populated.

- Updated dependencies [82642f7]
- Updated dependencies [095f819]
  - @technical-1/core@0.2.0

## 0.1.0

### Minor Changes

- 82df163: Browser foundation. `chrome-setup` resolves or downloads a Chrome build via
  `resolveChromePath`, `downloadChrome`, and the combining `ensureChrome`.
  `launcher` provides `launch`/`withBrowser` (guaranteed cleanup) and a
  fixed-size `BrowserPool`. `puppeteer-core` is a peer dependency of `launcher`.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
