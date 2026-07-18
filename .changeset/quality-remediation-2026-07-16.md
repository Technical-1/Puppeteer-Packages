---
"@technical-1/session": minor
"@technical-1/screenshots": minor
"@technical-1/config": minor
"@technical-1/network": patch
"@technical-1/downloads": patch
"@technical-1/fingerprint": patch
"@technical-1/launcher": patch
"@technical-1/captcha": patch
---

Fix pre-1.0 quality defects across eight packages:

- session (minor, breaking): `SessionSnapshot` now records a required `origin` field, and `restoreSession`'s injected script skips writing storage on any non-matching origin — callers hand-constructing snapshots must supply `origin`.
- screenshots (minor, breaking): `screenshot`/`screenshotElement` options are now typed as `Omit<ScreenshotOptions, 'encoding'>` so the `Uint8Array` return type is honest — passing `encoding` no longer type-checks.
- config (minor, breaking): `loadConfig`'s return type now surfaces optional fields with no default as `V | undefined` instead of falsely claiming presence — code that assumed presence gets a compile error.
- network (patch): `throttle`/`setOffline` reuse one cached CDP session per page instead of leaking a new session on every call.
- downloads (patch): mid-poll `readdir`/`stat` failures surface as a retryable `PptrKitError` instead of a raw Node error.
- fingerprint (patch): `navigator.languages` is derived from the `Accept-Language` header token list, so JS reads match the header (no en-fallback mismatch).
- launcher (patch): `BrowserPool` throws a terminal `PptrKitError` when constructed with a non-positive/non-integer size instead of deadlocking `acquire()`.
- captcha (patch): `injectToken` sets `.value` and dispatches `input`/`change` for input/textarea fields so Turnstile's hidden input is actually populated.
