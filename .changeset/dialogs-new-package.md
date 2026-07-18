---
"@technical-1/dialogs": minor
---

Add `@technical-1/dialogs`: a page-lifecycle JS dialog handler. `handleDialogs(page, options)` attaches a `page.on('dialog', …)` listener that auto-responds to alert/confirm/prompt/beforeunload dialogs per a configurable accept/dismiss policy, supplies prompt text, records typed `DialogEvent`s, takes an optional DI logger, and returns a disposer. Response failures are surfaced as a retryable `PptrKitError` via an `onError` callback.
