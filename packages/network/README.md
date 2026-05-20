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
```

## v1 limitations

- `captureResponses` records `{url, status, method, resourceType, timestamp}`.
  Does NOT capture headers or response bodies — full HAR-1.2 emission is the
  v2 surface noted in spec §5.
- `throttle` uses CDP `Network.emulateNetworkConditions`. Does NOT throttle
  WebSocket / WebRTC (CDP limitation).
- `blockResources` patterns are `ResourceType` strings (exact match) or
  `RegExp` (URL match). Globs are not supported in v1.

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping the underlying
puppeteer-core / CDP failure as `cause`. Transient I/O (`offline:true`
applied while the page was navigating) is `retryable:true`; programmer
errors (empty pattern list) are `retryable:false`.

## Peer

Requires `puppeteer-core` `>=22 <25`.
