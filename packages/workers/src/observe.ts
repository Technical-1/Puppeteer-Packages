import type { Page, WebWorker } from "puppeteer-core";
import { WorkerError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type { WorkerInfo, WorkerLifecycleEvent } from "./types.js";

export interface ObserveWorkersOptions extends LoggerOption {
  /** Invoked after each newly-created worker is recorded. */
  onWorkerCreated?: (info: WorkerInfo) => void;
  /** Invoked after each destroyed worker is recorded. */
  onWorkerDestroyed?: (info: WorkerInfo) => void;
  /** Invoked when a consumer callback throws (routed, never rethrown). */
  onError?: (error: WorkerError) => void;
}

export interface WorkerObserver {
  /** Every lifecycle transition observed so far, in order. */
  readonly events: readonly WorkerLifecycleEvent[];
  /** Workers created and not yet destroyed, in creation order. */
  readonly created: readonly WorkerInfo[];
  /** Detach both listeners. Idempotent. */
  dispose(): void;
}

/**
 * Attach `page.on('workercreated'|'workerdestroyed', …)` listeners that track
 * live workers and log/notify on each lifecycle transition. Returns a
 * disposer; call `dispose()` to detach.
 *
 * The listeners are synchronous — `page.workers()` payloads arrive
 * already-materialized, so no async responder or microtask flush is needed.
 */
export function observeWorkers(
  page: Page,
  opts: ObserveWorkersOptions = {},
): WorkerObserver {
  const events: WorkerLifecycleEvent[] = [];
  const created: WorkerInfo[] = [];
  let disposed = false;

  const handle = (kind: "created" | "destroyed", worker: WebWorker): void => {
    const url = worker.url();
    const info: WorkerInfo = { url, worker };
    events.push({ kind, url, worker });
    if (kind === "created") {
      created.push(info);
    } else {
      const i = created.findIndex((c) => c.worker === worker);
      if (i !== -1) created.splice(i, 1);
    }
    try {
      opts.logger?.log(`workers: ${kind} "${url}"`, "step");
      if (kind === "created") {
        opts.onWorkerCreated?.(info);
      } else {
        opts.onWorkerDestroyed?.(info);
      }
    } catch (cause) {
      const error = new WorkerError(
        `workers: consumer callback threw for ${kind} worker`,
        { retryable: true, cause, context: { kind, url } },
      );
      opts.logger?.log(error.message, "error");
      opts.onError?.(error);
    }
  };

  const onCreated = (w: WebWorker): void => handle("created", w);
  const onDestroyed = (w: WebWorker): void => handle("destroyed", w);
  page.on("workercreated", onCreated);
  page.on("workerdestroyed", onDestroyed);

  return {
    events,
    created,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      page.off("workercreated", onCreated);
      page.off("workerdestroyed", onDestroyed);
    },
  };
}
