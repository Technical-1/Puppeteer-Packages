---
"@technical-1/navigation": minor
---

`goto` now returns the `HTTPResponse | null` from the navigation so callers can
gate on HTTP status. `RetryOptions` is re-exported from the package barrel.
