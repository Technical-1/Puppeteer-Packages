# @technical-1/interaction-helpers

## 1.1.0

### Minor Changes

- 67642c1: Add `waitForFunction` (typed-timeout in-page predicate wait, `TimeoutError` on timeout) and `readClipboard` / `writeClipboard` (grant the clipboard permission on the page origin and read/write via `navigator.clipboard`; `ConfigError` on a non-secure origin). Both accept an optional injected `logger`.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0

## 1.0.0

### Major Changes

- Graduate the suite to its first stable release. All packages move to 1.0.0 with a committed, semver-stable public API: browser launch and a race-free pool, navigation with typed retries and gesture-triggered waits, data extraction, iframe-aware interaction, file upload, infinite scroll, keyboard shortcuts, device/viewport emulation, multi-tab/popup coordination, dialog handling, response capture and predicate event waits, session persistence, anti-detection building blocks, screenshots, PDF, downloads, and a captcha adapter interface — all sharing a typed, cross-realm-safe error hierarchy and a bring-your-own-logger contract, with puppeteer-core as a bounded peer dependency.

### Minor Changes

- 500834d: Expand interaction-helpers with iframe-aware interaction, file upload, infinite scroll, and keyboard shortcuts.

  - `safeClick`/`safeType`/`waitAndGet`/`scroll` now accept a `Page` or a `Frame`.
  - `resolveFrame(page, { name | url | selector })` locates a `Frame` (by name, url substring/RegExp, or `<iframe>` selector) for frame-scoped interaction.
  - `uploadFile` sets files on a plain `<input type=file>`; `uploadViaFileChooser` drives a styled button through the native file chooser. Both surface `SelectorNotFoundError`/`TimeoutError`.
  - `autoScroll` scrolls until lazy-loaded content stops growing (poll-until-stable with a settle wait and a `maxScrolls` cap).
  - `pressKey`/`pressShortcut` press Enter/Escape/Tab or Ctrl/Cmd/Shift/Alt + key combinations.
  - `ScrollOptions` now extends `LoggerOption` and `scroll` emits a `"step"` log line, matching the other helpers.

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

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
