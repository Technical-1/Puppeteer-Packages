# @technical-1/extract

Structured DOM extraction. Tolerant by design: list/table helpers return empty
collections (not throws) when nothing matches; schema extraction yields `""`
for absent fields. Uses `page.evaluate` under the hood. You inject the `Page`.

```ts
import { extractAll, extractTable, extractSchema } from "@technical-1/extract";

const titles = await extractAll(page, "h2.title");
const rows = await extractTable(page, "table#data");
const row = await extractSchema(page, { name: ".name", price: ".price" });
```
