# @technical-1/human

Humanize automation timing: randomized delays, per-keystroke typing cadence,
and stepwise mouse movement. You inject the `Page` (type-only `puppeteer-core`
peer). No `@technical-1/core` dependency.

```ts
import { humanDelay, humanType, humanMouseMove } from "@technical-1/human";

await humanDelay({ minMs: 200, maxMs: 800 });
await humanType(page, "#q", "hello");
await humanMouseMove(page, { x: 0, y: 0 }, { x: 400, y: 300 });
```
