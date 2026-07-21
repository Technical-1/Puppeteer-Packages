# @technical-1/workers

Web/Service Worker awareness for Puppeteer pages: enumerate workers, evaluate inside a worker, and observe worker lifecycle with typed events and a DI logger.

> **Convenience wrapper.** This package wraps puppeteer-core's `page.workers()`, `WebWorker.evaluate`, and the `workercreated`/`workerdestroyed` events with typed lifecycle events, typed errors (`WorkerError`), and a DI logger. It adds no capability beyond those primitives — it exists so worker enumeration, in-worker evaluation, and lifecycle tracking compose through one consistent, typed surface instead of three ad hoc call sites.

```ts
import { listWorkers, evaluateInWorker, observeWorkers } from "@technical-1/workers";

// Snapshot the page's currently-live workers:
const workers = listWorkers(page);
console.log(workers.map((w) => w.url));

// Run code inside a worker's realm:
const result = await evaluateInWorker(workers[0].worker, () => self.location.href);

// Track workers spawning/exiting for the page's lifetime:
const observer = observeWorkers(page, {
  onWorkerCreated: (info) => console.log("created", info.url),
  onWorkerDestroyed: (info) => console.log("destroyed", info.url),
  onError: (err) => console.error(err.message),
});

// ... run your flow ...

console.log(observer.created); // readonly WorkerInfo[] currently live
console.log(observer.events);  // readonly WorkerLifecycleEvent[] full history
observer.dispose();            // detach both listeners (idempotent)
```

## Errors

Evaluate failures (e.g. the worker was destroyed mid-evaluate, or the function threw) and
consumer-callback failures inside `observeWorkers` are surfaced as `WorkerError` from
`@technical-1/core`, discriminated by `err.name === "WorkerError"`, with `retryable:true`.
`evaluateInWorker` throws it directly; `observeWorkers` routes it to the `onError` callback
and the injected `logger` at level `error` — never thrown from inside the event listener.

## v1 limitations

- `listWorkers` returns a snapshot, not a live view — it does not update as workers
  spawn/exit (use `observeWorkers` for lifecycle tracking).
- `observeWorkers` attaches its own `workercreated`/`workerdestroyed` listener pair;
  multiple concurrent observers on one page all fire (puppeteer allows multiple
  listeners), so attach one.

## Peer

Requires `puppeteer-core` `>=22 <25`.
