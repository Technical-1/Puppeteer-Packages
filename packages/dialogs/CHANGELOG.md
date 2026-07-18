# @technical-1/dialogs

## 0.2.0

### Minor Changes

- 8c4c78c: Add `@technical-1/dialogs`: a page-lifecycle JS dialog handler. `handleDialogs(page, options)` attaches a `page.on('dialog', …)` listener that auto-responds to alert/confirm/prompt/beforeunload dialogs per a configurable accept/dismiss policy, supplies prompt text, records typed `DialogEvent`s, takes an optional DI logger, and returns a disposer. Response failures are surfaced as a retryable `PptrKitError` via an `onError` callback.

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
