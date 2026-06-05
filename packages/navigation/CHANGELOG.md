# @technical-1/navigation

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
- 55c0e59: `goto` now returns the `HTTPResponse | null` from the navigation so callers can
  gate on HTTP status. `RetryOptions` is re-exported from the package barrel.

### Patch Changes

- Updated dependencies [1bbfebd]
- Updated dependencies [c9fcbac]
  - @technical-1/core@0.1.0
  - @technical-1/retry@0.1.0
