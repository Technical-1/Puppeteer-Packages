---
"@technical-1/emulation": minor
---

Add `@technical-1/emulation`: device, viewport, and mobile emulation for Puppeteer pages.
`emulateDevice(page, target, options?)` applies a `KnownDevices` preset by name, a full
`Device` (`{ userAgent, viewport }`) via `page.emulate`, or a bare `Viewport`
(`{ width, height, deviceScaleFactor?, isMobile?, hasTouch?, isLandscape? }`) via
`page.setViewport`. `listKnownDevices()` returns the installed preset names. Failures throw
typed `PptrKitError`s (unknown preset name is non-retryable; page failures are retryable) and
an optional DI logger is supported. Permissions/geolocation/media/CPU overrides are
intentionally deferred to the 1.x line.
