# @technical-1/extract

Structured DOM extraction. Tolerant by design: list/table helpers return empty
collections (not throws) when nothing matches; schema extraction yields `""`
for absent fields. Uses `page.evaluate` under the hood. You inject the `Page`.
Infrastructure errors (a `page.evaluate` rejection from frame detachment, navigation, or a target crash) propagate as exceptions — the tolerant contract covers missing DOM nodes only, not page failures.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.evaluate()` with small helpers for common text, table, and schema extraction patterns. It doesn't add new capability beyond `page.evaluate()` — it exists so the rest of `@technical-1/*` composes through one consistent, typed surface with predictable empty-collection semantics. If you only need DOM extraction, you can call `page.evaluate()` directly.

> **ESM only.** This package ships ESM (`"type": "module"`). If you're in a
> fresh `npm init -y` project (CommonJS by default), add `"type": "module"` to
> your `package.json` — or use a `.mjs` file — before running the examples
> below, or Node throws `SyntaxError: Cannot use import statement outside a module`.

```ts
import { extractAll, extractTable, extractSchema } from "@technical-1/extract";

const titles = await extractAll(page, "h2.title");
const rows = await extractTable(page, "table#data");
const row = await extractSchema(page, { name: ".name", price: ".price" });
```

## Shadow-DOM piercing

Every extractor takes an optional `{ pierceShadow?: boolean }`. Default `false` = today's `document.querySelector(All)` (fast, no shadow traversal). `true` recurses through **open** shadow roots. Note: **closed** shadow roots are invisible to any script and cannot be pierced; `extractTable` piercing locates the table root only (cells within a nested-shadow table are out of scope). Example:

```ts
const label = await extractText(page, "span.price", { pierceShadow: true });
const items = await extractAll(page, "product-card .title", { pierceShadow: true });
```

## Pagination

`extractPaginated(page, { nextSelector, extractFn, maxPages, settleMs })` runs `extractFn` per page, clicks `nextSelector`, waits `settleMs`, and stops when the next control is gone or `maxPages` is hit. Document: a missing next control **ends the loop** (not an error — consistent with the tolerant contract); the `nextSelector` should match only an **active** next control (sites typically remove/hide it on the last page); `maxPages` defaults to 50 and is a safety bound; a click failure surfaces as a retryable `PptrKitError`. Example:

```ts
const all = await extractPaginated(page, {
  nextSelector: "a.pagination-next",
  extractFn: (p) => extractAll(p, "li.result .title"),
  maxPages: 20,
});
```

Note the DI logger is accepted here (`logger`) — the tolerant extractors do not log; only this orchestrator does.
