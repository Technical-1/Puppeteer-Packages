# @technical-1/stealth

## 1.0.0

### Major Changes

- Graduate the suite to its first stable release. All packages move to 1.0.0 with a committed, semver-stable public API: browser launch and a race-free pool, navigation with typed retries and gesture-triggered waits, data extraction, iframe-aware interaction, file upload, infinite scroll, keyboard shortcuts, device/viewport emulation, multi-tab/popup coordination, dialog handling, response capture and predicate event waits, session persistence, anti-detection building blocks, screenshots, PDF, downloads, and a captcha adapter interface — all sharing a typed, cross-realm-safe error hierarchy and a bring-your-own-logger contract, with puppeteer-core as a bounded peer dependency.

### Patch Changes

- 82642f7: Declare a supported Node floor (`engines.node >=18`, matching the puppeteer-core
  peer) on every package, and polish adoption docs: ESM-only notes on
  launcher/navigation/extract, a chrome-setup cross-link in the launcher
  quick-start, "TypeScript users only" @types/node wording in
  navigation/chrome-setup, and README nit fixes (autoScroll frame support,
  uploadFile parameter, network waiters import).

## 0.1.1

### Patch Changes

- 6ecf5eb: Clarify in each README that these are convenience wrappers — they add the suite's typed errors / injected logger / sane defaults for consistency, not new capability beyond the underlying puppeteer-core API or plugin.

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
