# @technical-1/extract

Structured DOM extraction. Tolerant by design: list/table helpers return empty
collections (not throws) when nothing matches; schema extraction yields `""`
for absent fields. Uses `page.evaluate` under the hood. You inject the `Page`.
Infrastructure errors (a `page.evaluate` rejection from frame detachment, navigation, or a target crash) propagate as exceptions — the tolerant contract covers missing DOM nodes only, not page failures.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.evaluate()` with small helpers for common text, table, and schema extraction patterns. It doesn't add new capability beyond `page.evaluate()` — it exists so the rest of `@technical-1/*` composes through one consistent, typed surface with predictable empty-collection semantics. If you only need DOM extraction, you can call `page.evaluate()` directly.

```ts
import { extractAll, extractTable, extractSchema } from "@technical-1/extract";

const titles = await extractAll(page, "h2.title");
const rows = await extractTable(page, "table#data");
const row = await extractSchema(page, { name: ".name", price: ".price" });
```
