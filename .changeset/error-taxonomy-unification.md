---
"@technical-1/core": minor
"@technical-1/config": minor
"@technical-1/launcher": minor
"@technical-1/downloads": minor
"@technical-1/network": minor
"@technical-1/retry": minor
"@technical-1/navigation": minor
---

Unify the suite error taxonomy so every thrown failure is a discriminable
`PptrKitError` subclass (cross-realm-safe `err.name`), not the generic base.

- core: add `ConfigError`, `PoolError`, `DownloadError`, `NetworkError`, and
  `AbortError` (each terminal by default; `DownloadError`/`NetworkError` pass
  `retryable:true` explicitly at their transient sites).
- config: missing-required-config now throws `ConfigError` (was base `PptrKitError`).
- launcher: an invalid `BrowserPool` size now throws terminal `PoolError`.
- downloads: snapshot/trigger/mid-poll failures throw `DownloadError`; the
  "no new file within Xms" poll timeout now throws the core `TimeoutError`.
- network: empty-pattern, body-not-enabled, body-read, invalid-JSON, and
  throttle failures throw `NetworkError`.
- retry: cancellation now throws `AbortError` (terminal) instead of a plain
  `Error("Aborted")`.
- navigation: aborts are detected by `err.name === "AbortError"` (was a fragile
  `message.startsWith("Aborted")` match), and the shared control flow of `goto`
  and `navigateOnGesture` is extracted into one internal `runNavigation` helper.

Migration: classify errors by the stable `err.name` / `err.retryable`
properties (already the documented contract). Code matching the exact string
`"PptrKitError"`, matching a cancelled navigation by `name === "Error"`, or
catching a bare `Error` from an aborted retry must switch to the new names.
