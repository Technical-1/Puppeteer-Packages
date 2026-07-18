---
"@technical-1/tabs": minor
---

Add `@technical-1/tabs`: multi-tab / popup coordination within a single browser.
`waitForNewPage` races a trigger callback against the browser's `'targetcreated'` event and
returns the first new page's `Page`; `waitForPageMatching` does the same but filters new
page targets by a URL predicate. Both apply a typed `TimeoutError` (default 30s) and
guarantee the `'targetcreated'` listener and timer are cleaned up on every exit path —
success, timeout, predicate-miss, or trigger failure. `puppeteer-core` is a peer
dependency; the package depends only on `@technical-1/core`.
