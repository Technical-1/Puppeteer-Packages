# @technical-1/network

Request blocking, response capture, and network throttling / offline
emulation for Puppeteer pages. Function-first surface; no class state.

```ts
import {
  blockResources,
  unblockResources,
  captureResponses,
  throttle,
  setOffline,
  THROTTLE_PROFILES,
  throttleCPU,
  mockRequests,
  waitForRequest,
  waitForResponse,
} from "@technical-1/network";
import { safeClick } from "@technical-1/interaction-helpers"; // used in the waiter example below

// Block images + analytics URLs:
await blockResources(page, ["image", /google-analytics/]);

// Capture all responses:
const collector = captureResponses(page);
// … run navigation …
console.log(collector.responses.length);
collector.stop();

// Capture XHR/fetch bodies too (opt-in, lazy):
const withBodies = captureResponses(page, { body: ["xhr", "fetch"] });
// … run navigation …
const [first] = withBodies.responses;
const payload = await first.json();

// Throttle to Fast 3G:
await throttle(page, THROTTLE_PROFILES.FAST_3G);

// Go offline:
await setOffline(page, true);

// Wait for one specific XHR fired by a UI action:
await Promise.all([
  waitForResponse(page, (res) => res.url().includes("/api/search") && res.status() === 200),
  safeClick(page, "#search-button"),
]);

// Mock / modify requests (composes with blockResources on the same page):
const stop = await mockRequests(page, [
  { when: /\/api\/me/, action: { kind: "respond", response: { status: 200, contentType: "application/json", body: '{"id":1}' } } },
  { when: (req) => req.method() === "PUT", action: { kind: "modify", overrides: { method: "POST" } } },
  { when: /doubleclick/, action: { kind: "abort", errorCode: "blockedbyclient" } },
]);
// … run navigation …
await stop();

// Throttle CPU to 4x slower (1 = no throttle):
await throttleCPU(page, 4);

// Inspect the redirect chain of a captured response:
const collector2 = captureResponses(page);
// … navigate through a 301 -> 302 -> 200 …
const [rec] = collector2.responses;
console.log(rec.redirects); // [{url, method, status:301}, {url, method, status:302}]
```

## v1 limitations

- `captureResponses` records `{url, status, method, resourceType, headers, fromCache,
  timestamp}` for every response. Response bodies are opt-in and lazy: pass
  `{ body: true }` (or `{ body: ["xhr","fetch"] }` to gate by resource type) and read
  them via the per-record `buffer()` / `text()` / `json()` accessors. A body must be
  awaited before the page navigates away — puppeteer discards it afterwards.
- `throttle` uses CDP `Network.emulateNetworkConditions`. Does NOT throttle
  WebSocket / WebRTC (CDP limitation).
- `blockResources` patterns are `ResourceType` strings (exact match) or
  `RegExp` (URL match). Globs are not supported in v1.
- `mockRequests` shares one page-global request interceptor with `blockResources` (single-owner
  coordination) — they compose safely on the same page. The FIRST matching rule wins; unmatched
  requests fall through untouched.
- `throttleCPU` uses CDP `Emulation.setCPUThrottlingRate`; `rate` is a slowdown multiplier
  (`1` = none, `4` = 4x slower). It reuses the same per-page CDP session as `throttle`.
- `captureResponses` records carry a `redirects` array (`{url, method, status}` hops) reconstructed
  from `redirectChain()`; the final hop is the record itself.

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping the underlying
puppeteer-core / CDP failure as `cause`. Transient I/O (`offline:true`
applied while the page was navigating) is `retryable:true`; programmer
errors (empty pattern list) are `retryable:false`.

`mockRequests` (empty rule list) and `throttleCPU` (`rate < 1`) throw a terminal `NetworkError`
(`retryable:false`); a `throttleCPU` CDP send failure is `retryable:true` (the cached session is
evicted so a retry re-attaches).

`waitForRequest` / `waitForResponse` surface a timeout as a `TimeoutError`
(`retryable:true`); a caller `AbortSignal` cancellation propagates unchanged.

## Peer

Requires `puppeteer-core` `>=22 <25`.
