# @technical-1/interaction-helpers

Hardened page interaction helpers. Same ergonomics as raw Puppeteer calls but
they throw the typed `@technical-1/core` error hierarchy (e.g.
`SelectorNotFoundError` carrying the selector) instead of opaque timeouts. You
inject the `Page` (this package imports only `puppeteer-core` types).

> **Convenience wrapper.** This package wraps puppeteer-core's `waitForSelector`, `click`, `type`, and related methods with the suite's typed error hierarchy (e.g. `SelectorNotFoundError`) instead of opaque timeouts. It doesn't add new interaction capability beyond those puppeteer-core primitives — it exists so the rest of `@technical-1/*` surfaces actionable, typed errors through one consistent DI seam. If you only need click/type/wait, you can use the puppeteer-core methods directly.

```ts
import { safeClick, waitAndGet } from "@technical-1/interaction-helpers";

await safeClick(page, "button#go");
const heading = await waitAndGet(page, "h1");
```

`safeClick` / `safeType` / `waitAndGet` / `scroll`.
