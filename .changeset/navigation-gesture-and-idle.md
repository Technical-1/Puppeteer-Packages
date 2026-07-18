---
"@technical-1/navigation": minor
---

Add `navigateOnGesture(page, gesture, opts)` for gesture-triggered navigation:
races `page.waitForNavigation` against the gesture under the same per-attempt
timeout + `withRetry` wrapping as `goto`, returning `HTTPResponse | null` and
wrapping surviving failures as a core `NavigationError`.

`waitForNetworkIdle` now accepts a `logger` (its options extend `LoggerOption`),
emits `step`/`error` log lines, and wraps a network-idle timeout as a core
`TimeoutError` (retryable) instead of leaking puppeteer-core's own error.

`goto` no longer rewraps a caller-cancelled navigation (aborted `retry.signal`)
as a retryable `NavigationError` — the abort passes through as a terminal error.
