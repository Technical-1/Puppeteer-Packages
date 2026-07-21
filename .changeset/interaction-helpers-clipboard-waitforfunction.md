---
"@technical-1/interaction-helpers": minor
---

Add `waitForFunction` (typed-timeout in-page predicate wait, `TimeoutError` on timeout) and `readClipboard` / `writeClipboard` (grant the clipboard permission on the page origin and read/write via `navigator.clipboard`; `ConfigError` on a non-secure origin). Both accept an optional injected `logger`.
