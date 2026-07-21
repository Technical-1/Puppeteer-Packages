import type { EvaluateFunc, Page, WebWorker } from "puppeteer-core";
import { WorkerError } from "@technical-1/core";
import type { WorkerInfo } from "./types.js";

/**
 * Snapshot the page's currently-live workers. Synchronous; wraps
 * `page.workers()`. The returned array is a fresh snapshot — it does not update
 * as workers spawn/exit (use `observeWorkers` for lifecycle tracking).
 */
export function listWorkers(page: Page): readonly WorkerInfo[] {
  return page.workers().map((worker) => ({ url: worker.url(), worker }));
}

/**
 * Evaluate `fn` inside the worker's realm (wraps `WebWorker.evaluate`). If the
 * worker rejects (e.g. it was destroyed mid-evaluate, or the function threw),
 * a retryable `WorkerError` is thrown with `cause` and `context: { url }`.
 *
 * Generics mirror puppeteer-core's `WebWorker.evaluate` so the return type is
 * inferred from `fn`.
 */
export async function evaluateInWorker<
  Params extends unknown[],
  Func extends EvaluateFunc<Params> = EvaluateFunc<Params>,
>(
  worker: WebWorker,
  fn: Func | string,
  ...args: Params
): Promise<Awaited<ReturnType<Func>>> {
  try {
    return await worker.evaluate(fn, ...args);
  } catch (cause) {
    throw new WorkerError("workers: evaluate in worker failed", {
      retryable: true,
      cause,
      context: { url: worker.url() },
    });
  }
}
