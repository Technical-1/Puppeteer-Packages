---
"@technical-1/human": minor
---

Add `dragAndDrop(page, sourceSelector, targetSelector, { steps? })`: resolves both selectors to their bounding-box centres and performs a humanized mouse down → interpolated move (via `humanMouseMove`) → up. Throws the typed `SelectorNotFoundError` for a missing or box-less element. This adds `@technical-1/core` as a runtime dependency (previously type-only `puppeteer-core`).
