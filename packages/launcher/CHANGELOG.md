# @technical-1/launcher

## 0.1.0

### Minor Changes

- 82df163: Browser foundation. `chrome-setup` resolves or downloads a Chrome build via
  `resolveChromePath`, `downloadChrome`, and the combining `ensureChrome`.
  `launcher` provides `launch`/`withBrowser` (guaranteed cleanup) and a
  fixed-size `BrowserPool`. `puppeteer-core` is a peer dependency of `launcher`.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
