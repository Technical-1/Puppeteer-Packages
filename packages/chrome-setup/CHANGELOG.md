# @technical-1/chrome-setup

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
- Updated dependencies [82642f7]
- Updated dependencies [095f819]
- Updated dependencies
  - @technical-1/core@1.0.0

## 0.1.0

### Minor Changes

- 82df163: Browser foundation. `chrome-setup` resolves or downloads a Chrome build via
  `resolveChromePath`, `downloadChrome`, and the combining `ensureChrome`.
  `launcher` provides `launch`/`withBrowser` (guaranteed cleanup) and a
  fixed-size `BrowserPool`. `puppeteer-core` is a peer dependency of `launcher`.
- 55c0e59: `ensureChrome`/`downloadChrome` install the latest stable Chrome by default
  (resolved at install time); pass an explicit `buildId` to pin a reproducible
  build (falls back to the pinned `DEFAULT_CHROME_BUILD` if resolution fails).
  `PlatformName` is now exported.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
