# @technical-1/human

Humanize automation timing: randomized delays, per-keystroke typing cadence,
and stepwise mouse movement. You inject the `Page` (type-only `puppeteer-core`
peer). No `@technical-1/core` dependency.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.keyboard.type()` and `page.mouse.move()` with simple randomized timing logic (uniform-random delays, per-keystroke cadence, linear interpolation for mouse paths). It doesn't implement bot-detection evasion or advanced human simulation — it exists so the rest of `@technical-1/*` has a consistent, injected timing seam. If you only need randomized delays or typed input, the underlying logic is a handful of lines around the puppeteer-core mouse/keyboard APIs.

```ts
import { humanDelay, humanType, humanMouseMove } from "@technical-1/human";

await humanDelay({ minMs: 200, maxMs: 800 });
await humanType(page, "#q", "hello");
await humanMouseMove(page, { x: 0, y: 0 }, { x: 400, y: 300 });
```
