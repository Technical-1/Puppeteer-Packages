# @technical-1/tabs

Coordinate popups and new tabs **within one browser**. Race a user gesture (a click that
calls `window.open`, or a `target="_blank"` navigation) against the browser's
`'targetcreated'` event and get back the settled `Page` — with a typed timeout and
guaranteed listener cleanup. You inject the `Browser`.

This is not process pooling: `@technical-1/launcher`'s `BrowserPool` pools whole browser
processes; `tabs` waits for a new page inside a browser you already have.

```ts
import { waitForNewPage, waitForPageMatching } from "@technical-1/tabs";

// Wait for whatever tab the click opens:
const popup = await waitForNewPage(browser, () => page.click("a[target=_blank]"));

// Wait for a specific popup by URL:
const checkout = await waitForPageMatching(
  browser,
  () => page.click("#pay"),
  (url) => url.startsWith("https://checkout.example.com/"),
  { timeout: 15_000 },
);
```

## Behaviour

- The `'targetcreated'` listener is attached **before** your trigger runs, so a popup that
  opens synchronously during the click is never missed.
- Only page-type targets are considered (`service_worker` / `background_page` targets are
  ignored). `waitForPageMatching` further filters by your URL predicate; a predicate or
  `target.url()` that throws just skips that target.
- On success, timeout, or failure the listener is detached and the timer cleared — nothing
  leaks.

## Errors

- **Timeout** (no matching page in `timeout` ms, default `30000`) → a `@technical-1/core`
  `TimeoutError` with `retryable: true` and `context: { timeout }`.
- **Trigger threw** or **target page could not be resolved** → a `@technical-1/core`
  `PptrKitError` with `retryable: false`, carrying the original `cause`.

## Requirements

`puppeteer-core` is a **peer dependency** (`>=22 <25`) — install it in your project. This
package does not launch or close browsers.
