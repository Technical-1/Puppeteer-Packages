import type { WebWorker } from "puppeteer-core";

/** A single live worker: its script URL plus the underlying WebWorker handle. */
export interface WorkerInfo {
  /** The worker's script URL (`WebWorker.url()`). */
  readonly url: string;
  /** The underlying puppeteer WebWorker (use with `evaluateInWorker`). */
  readonly worker: WebWorker;
}

/** Which side of the lifecycle a `WorkerLifecycleEvent` records. */
export type WorkerLifecycleKind = "created" | "destroyed";

/** Immutable record of one worker lifecycle transition. */
export interface WorkerLifecycleEvent {
  readonly kind: WorkerLifecycleKind;
  readonly url: string;
  readonly worker: WebWorker;
}
