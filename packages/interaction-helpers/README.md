# @technical-1/interaction-helpers

Hardened page interaction helpers. Same ergonomics as raw Puppeteer calls but
they throw the typed `@technical-1/core` error hierarchy (e.g.
`SelectorNotFoundError` carrying the selector) instead of opaque timeouts. You
inject the `Page` (this package imports only `puppeteer-core` types).

```ts
import { safeClick, waitAndGet } from "@technical-1/interaction-helpers";

await safeClick(page, "button#go");
const heading = await waitAndGet(page, "h1");
```

`safeClick` / `safeType` / `waitAndGet` / `scroll`.
