# @technical-1/human

Humanize automation timing: randomized delays, per-keystroke typing cadence,
stepwise mouse movement, and humanized drag-and-drop. You inject the `Page`
(type-only `puppeteer-core` peer). Depends on `@technical-1/core` only for
the typed `SelectorNotFoundError` thrown by `dragAndDrop`.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.keyboard.type()` and `page.mouse.move()` with simple randomized timing logic (uniform-random delays, per-keystroke cadence, linear interpolation for mouse paths). It doesn't implement bot-detection evasion or advanced human simulation — it exists so the rest of `@technical-1/*` has a consistent, injected timing seam. If you only need randomized delays or typed input, the underlying logic is a handful of lines around the puppeteer-core mouse/keyboard APIs.

```ts
import {
  humanDelay,
  humanType,
  humanMouseMove,
  dragAndDrop,
} from "@technical-1/human";

await humanDelay({ minMs: 200, maxMs: 800 });
await humanType(page, "#q", "hello");
await humanMouseMove(page, { x: 0, y: 0 }, { x: 400, y: 300 });
await dragAndDrop(page, "#card-1", "#column-done"); // sortable / drag-zone
```

`dragAndDrop` resolves both selectors to their bounding-box centres, then
performs move → down → interpolated move (via `humanMouseMove`) → up. It
throws `SelectorNotFoundError` if either selector is missing or resolves to
an element with no bounding box.
