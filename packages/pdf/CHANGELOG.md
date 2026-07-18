# @technical-1/pdf

## 0.1.2

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
- 55c0e59: `pageToPdf` deep-merges the `margin` per side, so a partial margin keeps the
  unspecified sides at the 1cm default instead of dropping them to 0.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
