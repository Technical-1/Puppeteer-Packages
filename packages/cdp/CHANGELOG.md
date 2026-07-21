# @technical-1/cdp

## 1.1.0

### Minor Changes

- acf980e: New package: a generic CDPSession escape hatch. `openCdpSession(source)` opens a
  typed, error-wrapped session from a Page or Target; `withCdpSession(source, fn)`
  runs a scope with a guaranteed `detach()` in finally. Thin `send` / `on` / `detach`
  wrapper over puppeteer-core's `CDPSession`, with failures surfaced as `CdpError`.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
