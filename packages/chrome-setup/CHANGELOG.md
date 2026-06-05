# @technical-1/chrome-setup

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
