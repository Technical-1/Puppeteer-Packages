# @technical-1/tabs

## 0.1.0

### Minor Changes

- 6313804: Add `@technical-1/tabs`: multi-tab / popup coordination within a single browser.
  `waitForNewPage` races a trigger callback against the browser's `'targetcreated'` event and
  returns the first new page's `Page`; `waitForPageMatching` does the same but filters new
  page targets by a URL predicate. Both apply a typed `TimeoutError` (default 30s) and
  guarantee the `'targetcreated'` listener and timer are cleaned up on every exit path —
  success, timeout, predicate-miss, or trigger failure. `puppeteer-core` is a peer
  dependency; the package depends only on `@technical-1/core`.

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
