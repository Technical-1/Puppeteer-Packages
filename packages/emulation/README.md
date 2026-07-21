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

## Overrides

Beyond device/viewport emulation, this package ships three standalone override functions —
`overridePermissions`, `setGeolocation`, and `emulateMedia`. Each is a typed-error,
step-logging function following the same conventions as `emulateDevice`.

```ts
import { overridePermissions, setGeolocation, emulateMedia } from "@technical-1/emulation";

// Grant permissions (camera/mic/geolocation/notifications/clipboard) on a page's context
await overridePermissions(page, ["geolocation", "notifications"]);

// Set coordinates — geolocation requires the permission, so grant + set together:
await setGeolocation(page, { latitude: 48.8584, longitude: 2.2945, accuracy: 5 }, {
  grantPermission: true,
});

// Emulate dark mode + print media
await emulateMedia(page, { colorScheme: "dark", reducedMotion: "reduce" });
await emulateMedia(page, { mediaType: "print" }); // e.g. before @technical-1/pdf
```

- **`overridePermissions(target, permissions, options?)`** — grants a set of browser
  permissions on a `BrowserContext` or on the context owning a `Page`. Pass a `BrowserContext`
  with a required `origin`, or a `Page`, whose origin defaults to its current URL when
  omitted. Throws `ConfigError` (`retryable: false`) for an empty `permissions` list, a
  missing `origin` when targeting a `BrowserContext`, or an origin that can't be derived from
  the page (e.g. `about:blank`). A rejection from the underlying call is wrapped as
  `PptrKitError` (`retryable: true`).

  This wraps puppeteer-core's `BrowserContext.overridePermissions`, which the types mark
  deprecated in favor of `setPermission`. The wrapper is intentional for the grant-a-set
  ergonomics; callers needing per-descriptor state control can use `setPermission` directly.

- **`setGeolocation(page, coords, options?)`** — sets range-validated coordinates
  (`latitude` -90..90, `longitude` -180..180, `accuracy` >= 0). `page.setGeolocation`
  requires the `geolocation` permission to already be granted, or it has no visible effect —
  pass `grantPermission: true` to grant it (via `overridePermissions`) before setting the
  coordinates. Throws `ConfigError` (`retryable: false`) for out-of-range/non-finite values.

- **`emulateMedia(page, media, options?)`** — emulates CSS media type (`page.emulateMediaType`)
  and/or media features (`page.emulateMediaFeatures`): `prefers-color-scheme`,
  `prefers-reduced-motion`, `forced-colors`, `color-gamut`. Throws `ConfigError`
  (`retryable: false`) when `media` provides neither a `mediaType` key nor any feature.

CPU throttling remains out of scope for this package.

## Install

```sh
pnpm add @technical-1/emulation puppeteer-core
```

`puppeteer-core` is a peer dependency (`>=22 <25`); bring your own.
