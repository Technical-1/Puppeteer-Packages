---
"@technical-1/extract": minor
---

Add shadow-DOM piercing and a pagination iterator.

- `extractText`/`extractAll`/`extractTable`/`extractSchema` accept an optional
  `{ pierceShadow?: boolean }` that recurses through open shadow roots to reach
  content inside web components. Default `false` preserves existing behavior.
- New `extractPaginated(page, { nextSelector, extractFn, maxPages, settleMs })`
  runs an extractor across a paginated listing, clicking "next" until the control
  disappears or `maxPages` is reached, aggregating all results.
