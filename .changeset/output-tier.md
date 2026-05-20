---
"@technical-1/screenshots": minor
"@technical-1/pdf": minor
"@technical-1/downloads": minor
---

Output tier: `screenshots` (timestamped/full-page/element capture helpers
ported from the Kanfer baseline), `pdf` (`pageToPdf` with sane defaults —
A4, printBackground, 1cm margins), and `downloads` (`enableDownloads` via
CDP `Browser.setDownloadBehavior` + `awaitDownload` filesystem polling).
All three declare `@technical-1/core` as a dependency and `puppeteer-core`
`>=22 <25` as a peer. `screenshots.screenshotElement` throws
`SelectorNotFoundError` (terminal); all other thrown failures are
`PptrKitError` with explicit `retryable` (typically `true` for CDP /
page-state transients; `false` for snapshot/trigger programmer errors in
`downloads`).
