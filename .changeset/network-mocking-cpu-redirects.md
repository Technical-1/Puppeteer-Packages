---
"@technical-1/network": minor
---

Add request mocking, CPU throttling, and redirect-chain inspection.

- `mockRequests(page, rules, opts)` fulfils (`respond`), modifies (`continue` with
  header/method/postData/url overrides), or aborts (with a specific CDP error code) matching
  requests, returning an async disposer. It composes with `blockResources` through a shared
  single-owner interception coordinator — no double `setRequestInterception`.
- `throttleCPU(page, rate, opts)` sends CDP `Emulation.setCPUThrottlingRate`, reusing the same
  per-page CDP session cache as `throttle`/`setOffline` (no per-call session leak). `rate < 1`
  throws a terminal `NetworkError`; a CDP failure is retryable and evicts the session.
- `captureResponses` records now carry a `redirects` array of `{url, method, status}` hops
  reconstructed from `redirectChain()`, exposing the 301→302→200 sequence.
