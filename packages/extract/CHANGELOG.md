# @technical-1/extract

## 1.1.0

### Minor Changes

- b163aeb: Add shadow-DOM piercing and a pagination iterator.

  - `extractText`/`extractAll`/`extractTable`/`extractSchema` accept an optional
    `{ pierceShadow?: boolean }` that recurses through open shadow roots to reach
    content inside web components. Default `false` preserves existing behavior.
  - New `extractPaginated(page, { nextSelector, extractFn, maxPages, settleMs })`
    runs an extractor across a paginated listing, clicking "next" until the control
    disappears or `maxPages` is reached, aggregating all results.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0

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

- 6cbd672: Navigation & data tier: `interaction-helpers` (hardened
  `safeClick`/`safeType`/`waitAndGet`/`scroll` throwing typed core errors),
  `navigation` (`goto` with retry + `waitForNetworkIdle`), and `extract`
  (`extractText`/`extractAll`/`extractTable`/`extractSchema` DOM extraction).
  All declare `puppeteer-core` as a peer. `navigation` is the first capability
  package to depend on an internal utility (`@technical-1/retry`) in addition to
  `core`. `extract` is standalone — no `@technical-1/core` dependency (returns
  `""`/`[]`, never throws typed errors).
