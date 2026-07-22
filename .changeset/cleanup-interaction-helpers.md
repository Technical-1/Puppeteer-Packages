---
"@technical-1/interaction-helpers": patch
---

`waitForFunction` now only wraps a genuine timeout as a retryable `TimeoutError`; a deterministic predicate-evaluation error (e.g. a `ReferenceError` in the page function) surfaces as a non-retryable `PptrKitError` so it is not retried indefinitely.
