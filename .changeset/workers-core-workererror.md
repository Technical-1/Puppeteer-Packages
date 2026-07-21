---
"@technical-1/core": minor
---

Add `WorkerError`, a typed discriminant for Web/Service Worker evaluation and
lifecycle failures (terminal by default; transient callers pass
`retryable:true`). Discriminate by `err.name === "WorkerError"`.
