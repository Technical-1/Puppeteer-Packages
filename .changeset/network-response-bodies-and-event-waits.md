---
"@technical-1/network": minor
---

Expand response capture and add predicate event waits.

- `captureResponses` records now carry `headers` and `fromCache` (captured
  eagerly) and expose opt-in, awaitable `buffer()`/`text()`/`json()` body
  accessors gated by resource type via a new `body` option. Bodies are pulled
  lazily on first `await` and cached; disabled accessors throw a terminal
  `PptrKitError`.
- `captureResponses` is now synchronous (returns `ResponseCollector` instead of
  `Promise<ResponseCollector>`); `await`ing callers are unaffected.
- New `waitForRequest` / `waitForResponse` predicate single-event waits wrap the
  raw puppeteer calls with a typed `TimeoutError` (`retryable:true`); an
  `AbortSignal` cancellation passes through untouched.
