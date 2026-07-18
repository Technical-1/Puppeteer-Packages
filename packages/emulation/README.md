# @technical-1/emulation

Device, viewport, and mobile emulation for a Puppeteer `Page` — `KnownDevices` presets,
`deviceScaleFactor`, `isMobile`, `hasTouch`, `isLandscape`, and arbitrary viewports. You
inject the `Page` (type-only `puppeteer-core` peer). Errors are typed `PptrKitError`s from
`@technical-1/core`; pass an optional DI `logger`.

```ts
import { emulateDevice, listKnownDevices } from "@technical-1/emulation";

// 1) A named KnownDevices preset (applies UA + viewport via page.emulate)
await emulateDevice(page, "iPhone 15 Pro");

// 2) A full custom Device (UA + viewport)
await emulateDevice(page, {
  userAgent: "Mozilla/5.0 (custom) Chrome/144.0.0.0",
  viewport: { width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
});

// 3) A bare viewport (applies via page.setViewport) — arbitrary sizes + touch/mobile flags
await emulateDevice(page, { width: 1280, height: 720 });
await emulateDevice(page, { width: 400, height: 800, isMobile: true, hasTouch: true });

// Discover the presets your installed puppeteer-core ships:
listKnownDevices(); // ["Blackberry PlayBook", …, "iPhone 15 Pro", …]
```

## Behavior

- **Preset name** (`string`) → looked up in `puppeteer-core`'s `KnownDevices`, applied via
  `page.emulate` (sets both user agent and viewport, including `deviceScaleFactor` /
  `isMobile` / `hasTouch`). An unknown name throws `PptrKitError` with `retryable: false`
  (deterministic caller error).
- **`Device`** (`{ userAgent, viewport }`) → applied via `page.emulate`.
- **`Viewport`** (`{ width, height, deviceScaleFactor?, isMobile?, hasTouch?, isLandscape? }`)
  → applied via `page.setViewport` (viewport only; user agent unchanged).

A `page.emulate` / `page.setViewport` rejection is wrapped as `PptrKitError` with
`retryable: true`, carrying the original error as `cause`.

`page.emulate` registers the user-agent/viewport for **subsequent** navigations — call
`emulateDevice` **before** `page.goto`. To keep a spoofed UA's `Chrome/<version>` token in
sync with the live binary, or to randomize UA/locale/timezone, compose with
`@technical-1/fingerprint`.

## Scope (v0.x)

This package covers device / viewport / mobile emulation only. The override axes —
**permissions**, **geolocation**, **media features / media type**, and **CPU throttling** —
are intentionally **out of scope for 0.x** and are planned for the 1.x line. The
`EmulateDeviceOptions` interface is the extension point for those additions; nothing today
touches those CDP domains.

## Install

```sh
pnpm add @technical-1/emulation puppeteer-core
```

`puppeteer-core` is a peer dependency (`>=22 <25`); bring your own.
