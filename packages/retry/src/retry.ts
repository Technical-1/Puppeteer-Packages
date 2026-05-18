import type { LoggerOption } from "@technical-1/core";

export interface RetryOptions extends LoggerOption {
  /** Number of retries after the initial attempt. Default 3. */
  retries?: number;
  /** Base delay in ms before the first retry. Default 200. */
  minDelayMs?: number;
  /** Maximum delay in ms between retries. Default 5000. */
  maxDelayMs?: number;
  /** Exponential growth factor. Default 2. */
  factor?: number;
  /** Apply random jitter in [0, delay). Default true. */
  jitter?: boolean;
  /** Cancellation signal; aborts pending waits and prevents further attempts. */
  signal?: AbortSignal;
  /**
   * Decide whether a thrown error is retryable. Default: cross-realm-safe
   * property check (`err.retryable === true`) per the @technical-1/core
   * contract — intentionally NOT an `instanceof` check.
   */
  isRetryable?: (err: unknown) => boolean;
}

function defaultIsRetryable(err: unknown): boolean {
  try {
    return (
      typeof err === "object" &&
      err !== null &&
      "retryable" in err &&
      (err as { retryable?: unknown }).retryable === true
    );
  } catch {
    // An error object with a throwing `retryable` getter must not escape
    // the predicate as an uncaught exception — treat it as terminal.
    return false;
  }
}

function delayFor(attempt: number, o: Required<Pick<RetryOptions, "minDelayMs" | "maxDelayMs" | "factor" | "jitter">>): number {
  const raw = o.minDelayMs * Math.pow(o.factor, attempt - 1);
  const capped = Math.min(raw, o.maxDelayMs);
  return o.jitter ? Math.random() * capped : capped;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      // Resolve path: `onAbort` was registered with { once: true }, but
      // { once: true } only auto-detaches a listener that actually FIRED.
      // Here abort never fired, so the listener is still attached — remove
      // it explicitly to avoid leaking on a long-lived/shared AbortSignal.
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Run `fn(attempt)` (attempt is 1-based) with exponential backoff. Retries
 * only retryable errors while attempts remain; otherwise rethrows the error.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const cfg = {
    minDelayMs: opts.minDelayMs ?? 200,
    maxDelayMs: opts.maxDelayMs ?? 5000,
    factor: opts.factor ?? 2,
    jitter: opts.jitter ?? true,
  };
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  if (opts.signal?.aborted) throw new Error("Aborted before first attempt");

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      const exhausted = attempt > retries;
      if (exhausted || !isRetryable(err)) throw err;
      opts.logger?.log(
        `retry ${attempt}/${retries} after error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "warn",
      );
      await sleep(delayFor(attempt, cfg), opts.signal);
    }
  }
}
