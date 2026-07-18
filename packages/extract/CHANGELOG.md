# @technical-1/extract

## 0.1.2

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

- 6cbd672: Navigation & data tier: `interaction-helpers` (hardened
  `safeClick`/`safeType`/`waitAndGet`/`scroll` throwing typed core errors),
  `navigation` (`goto` with retry + `waitForNetworkIdle`), and `extract`
  (`extractText`/`extractAll`/`extractTable`/`extractSchema` DOM extraction).
  All declare `puppeteer-core` as a peer. `navigation` is the first capability
  package to depend on an internal utility (`@technical-1/retry`) in addition to
  `core`. `extract` is standalone — no `@technical-1/core` dependency (returns
  `""`/`[]`, never throws typed errors).
