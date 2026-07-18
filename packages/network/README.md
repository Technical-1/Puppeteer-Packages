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
  waitForRequest,
  waitForResponse,
} from "@technical-1/network";

// Block images + analytics URLs:
await blockResources(page, ["image", /google-analytics/]);

// Capture all responses:
const collector = await captureResponses(page);
// … run navigation …
console.log(collector.responses.length);
collector.stop();

// Throttle to Fast 3G:
await throttle(page, THROTTLE_PROFILES.FAST_3G);

// Go offline:
await setOffline(page, true);

// Wait for one specific XHR fired by a UI action:
await Promise.all([
  waitForResponse(page, (res) => res.url().includes("/api/search") && res.status() === 200),
  safeClick(page, "#search-button"),
]);
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

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping the underlying
puppeteer-core / CDP failure as `cause`. Transient I/O (`offline:true`
applied while the page was navigating) is `retryable:true`; programmer
errors (empty pattern list) are `retryable:false`.

`waitForRequest` / `waitForResponse` surface a timeout as a `TimeoutError`
(`retryable:true`); a caller `AbortSignal` cancellation propagates unchanged.

## Peer

Requires `puppeteer-core` `>=22 <25`.
