# @technical-1/workers

## 1.1.1

### Patch Changes

- a864617: Clarify the lifecycle-handler error message in `observeWorkers` (it can originate from the consumer callback or the logger), and document the deliberate error-path boundary.

## 1.1.0

### Minor Changes

- 318a6cb: Initial release of `@technical-1/workers`: Web/Service Worker awareness for
  Puppeteer pages. `listWorkers(page)` enumerates live workers, `evaluateInWorker`
  runs a function inside a worker's realm with typed `WorkerError` translation, and
  `observeWorkers(page, opts)` attaches `workercreated`/`workerdestroyed` listeners
  returning a disposer with typed lifecycle events and a DI logger.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
