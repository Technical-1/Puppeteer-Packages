---
"@technical-1/coverage": minor
---

Add `@technical-1/coverage`: JS + CSS coverage collection for Puppeteer pages.
`collectCoverage(page, fn, options?)` starts `page.coverage` (JS and/or CSS), runs the
caller's function, and **guarantees a stop in `finally`**, returning the function's result
alongside per-file used/unused byte ranges (`FileCoverage`) and rolled-up `js`/`css`/`total`
summaries (total vs used bytes, used ratio). `resetOnNavigation` defaults to `false` so a
`page.goto` inside the window is not wiped. Misuse (both domains disabled) throws a
non-retryable `ConfigError`; CDP start/stop failures throw a retryable `PptrKitError` carrying
the cause; the caller's own errors are re-thrown unwrapped. `puppeteer-core` is a type-only
peer dependency; an optional DI logger is supported.
