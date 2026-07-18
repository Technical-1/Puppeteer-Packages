# @technical-1/fingerprint

## 0.1.1

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

## 0.1.0

### Minor Changes

- b8a179c: Anti-detection tier: `stealth` (puppeteer-extra-plugin-stealth wrapper;
  `puppeteer-extra` is a real dependency), `fingerprint`
  (`randomFingerprint`/`applyFingerprint`), `human` (`humanDelay`/`humanType`/
  `humanMouseMove`), and `proxy` (`proxyArg`/`applyProxyAuth`/`ProxyRotator`,
  throwing `core` `ProxyError`). `fingerprint`/`human`/`proxy` declare
  `puppeteer-core` as a peer; `stealth` is standalone (no `puppeteer-core` peer;
  the consumer passes their puppeteer instance). `fingerprint`/`human` are
  standalone (no `@technical-1/core` dep); `proxy` depends on core for `ProxyError`.
- 55c0e59: `applyFingerprint` reconciles the spoofed UA's Chrome version to the live
  browser and overrides in-page `navigator.language`/`languages`.
  `randomFingerprint` now produces geographically-coherent locale/timezone pairs.
