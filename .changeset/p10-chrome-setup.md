---
"@technical-1/chrome-setup": minor
---

`ensureChrome`/`downloadChrome` install the latest stable Chrome by default
(resolved at install time); pass an explicit `buildId` to pin a reproducible
build (falls back to the pinned `DEFAULT_CHROME_BUILD` if resolution fails).
`PlatformName` is now exported.
