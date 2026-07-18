# @technical-1/emulation

## 0.2.0

### Minor Changes

- 38d1cd5: Add `@technical-1/emulation`: device, viewport, and mobile emulation for Puppeteer pages.
  `emulateDevice(page, target, options?)` applies a `KnownDevices` preset by name, a full
  `Device` (`{ userAgent, viewport }`) via `page.emulate`, or a bare `Viewport`
  (`{ width, height, deviceScaleFactor?, isMobile?, hasTouch?, isLandscape? }`) via
  `page.setViewport`. `listKnownDevices()` returns the installed preset names. Failures throw
  typed `PptrKitError`s (unknown preset name is non-retryable; page failures are retryable) and
  an optional DI logger is supported. Permissions/geolocation/media/CPU overrides are
  intentionally deferred to the 1.x line.

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
