# @technical-1/screenshots

Timestamped, full-page, and element screenshot helpers for Puppeteer pages.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.screenshot()` with timestamped path generation and the suite's typed errors (`PptrKitError`). It doesn't add new capability beyond `page.screenshot()` — it exists so the rest of `@technical-1/*` composes through one consistent, typed surface. If you only need screenshots, you can call `page.screenshot()` directly.

```ts
import { screenshot, screenshotElement, timestampedPath } from "@technical-1/screenshots";

// Buffer return (no `path` option):
const buf = await screenshot(page, { fullPage: true });

// Write to disk with a timestamped name:
await screenshot(page, { path: timestampedPath("./out", "homepage", "png"), fullPage: true });

// Element-scoped capture:
await screenshotElement(page, "#hero", { path: "./hero.png" });
```

## v1 limitations

- Pure pass-through to `page.screenshot` / element-handle `screenshot` —
  no auto-clip-from-element-bounding-box, no quality-aware format fallback.

## Errors

Throws `PptrKitError` from `@technical-1/core` wrapping puppeteer-core
failures. Missing-selector failures from `screenshotElement` are
`retryable:false` (deterministic); transient page failures are
`retryable:true`.

## Peer

Requires `puppeteer-core` `>=22 <25`.
