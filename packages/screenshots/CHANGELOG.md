# @technical-1/screenshots

## 0.2.0

### Minor Changes

- 3792835: Fix pre-1.0 quality defects across eight packages:

  - session (minor, breaking): `SessionSnapshot` now records a required `origin` field, and `restoreSession`'s injected script skips writing storage on any non-matching origin — callers hand-constructing snapshots must supply `origin`.
  - screenshots (minor, breaking): `screenshot`/`screenshotElement` options are now typed as `Omit<ScreenshotOptions, 'encoding'>` so the `Uint8Array` return type is honest — passing `encoding` no longer type-checks.
  - config (minor, breaking): `loadConfig`'s return type now surfaces optional fields with no default as `V | undefined` instead of falsely claiming presence — code that assumed presence gets a compile error.
  - network (patch): `throttle`/`setOffline` reuse one cached CDP session per page instead of leaking a new session on every call.
  - downloads (patch): mid-poll `readdir`/`stat` failures surface as a retryable `PptrKitError` instead of a raw Node error.
  - fingerprint (patch): `navigator.languages` is derived from the `Accept-Language` header token list, so JS reads match the header (no en-fallback mismatch).
  - launcher (patch): `BrowserPool` throws a terminal `PptrKitError` when constructed with a non-positive/non-integer size instead of deadlocking `acquire()`.
  - captcha (patch): `injectToken` sets `.value` and dispatches `input`/`change` for input/textarea fields so Turnstile's hidden input is actually populated.

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

## 0.1.1

### Patch Changes

- 6ecf5eb: Clarify in each README that these are convenience wrappers — they add the suite's typed errors / injected logger / sane defaults for consistency, not new capability beyond the underlying puppeteer-core API or plugin.

## 0.1.0

### Minor Changes

- 0d299da: Output tier: `screenshots` (timestamped/full-page/element capture helpers
  ported from the Kanfer baseline), `pdf` (`pageToPdf` with sane defaults —
  A4, printBackground, 1cm margins), and `downloads` (`enableDownloads` via
  CDP `Browser.setDownloadBehavior` + `awaitDownload` filesystem polling).
  All three declare `@technical-1/core` as a dependency and `puppeteer-core`
  `>=22 <25` as a peer. `screenshots.screenshotElement` throws
  `SelectorNotFoundError` (terminal); all other thrown failures are
  `PptrKitError` with explicit `retryable` (typically `true` for CDP /
  page-state transients; `false` for snapshot/trigger programmer errors in
  `downloads`).

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
