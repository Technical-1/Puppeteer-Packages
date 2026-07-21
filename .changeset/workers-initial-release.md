---
"@technical-1/workers": minor
---

Initial release of `@technical-1/workers`: Web/Service Worker awareness for
Puppeteer pages. `listWorkers(page)` enumerates live workers, `evaluateInWorker`
runs a function inside a worker's realm with typed `WorkerError` translation, and
`observeWorkers(page, opts)` attaches `workercreated`/`workerdestroyed` listeners
returning a disposer with typed lifecycle events and a DI logger.
