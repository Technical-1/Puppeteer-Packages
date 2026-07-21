---
"@technical-1/emulation": minor
---

Add permission, geolocation, and media override functions: `overridePermissions`
(grant camera/mic/geolocation/notifications/clipboard on a page's or context's origin),
`setGeolocation` (range-validated coordinates with an optional `grantPermission`
convenience), and `emulateMedia` (`prefers-color-scheme`, `prefers-reduced-motion`,
`forced-colors`, `color-gamut`, and media type). Each is a typed-error, step-logging
function following the existing `emulateDevice` conventions.
