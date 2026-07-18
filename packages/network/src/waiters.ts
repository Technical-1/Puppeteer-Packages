import { TimeoutError } from "@technical-1/core";
import type { HTTPRequest, HTTPResponse, Page } from "puppeteer-core";

export interface WaitForEventOptions {
  /** Max wait in ms. Default 30_000. Pass 0 to disable puppeteer's timeout. */
  timeoutMs?: number;
  /** Abort signal to cancel the wait; cancellation passes through untouched. */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wait for the first request satisfying `predicate`. Thin wrapper over
 * `page.waitForRequest` that surfaces a timeout as a `@technical-1/core`
 * `TimeoutError` (`retryable:true`). A caller-initiated `AbortSignal` cancel
 * passes through untouched — it is NOT rewrapped as a retryable timeout.
 */
export async function waitForRequest(
  page: Page,
  predicate: (req: HTTPRequest) => boolean | Promise<boolean>,
  opts: WaitForEventOptions = {},
): Promise<HTTPRequest> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = opts;
  try {
    return await page.waitForRequest(predicate, { timeout: timeoutMs, signal });
  } catch (cause) {
    // Detection must be based on the ERROR'S PROVENANCE, not just current
    // signal state: puppeteer races timeout(ms) / fromAbortSignal(signal) /
    // close together, so on abort it throws `signal.reason` directly, while
    // on timeout it throws its OWN TimeoutError. Checking only
    // `signal?.aborted` admits a race where the caller aborts the (possibly
    // shared) signal in the microtask window after puppeteer's timeout has
    // already won and rejected — `signal.aborted` reads true even though the
    // thrown error is the unrelated genuine timeout, so a state-only check
    // would rethrow that raw, non-retryable error instead of wrapping it.
    // Match on the thrown error itself: either it *is* `signal.reason`
    // (the exact object puppeteer throws for an abort), or it's a default
    // `AbortController.abort()` DOMException named "AbortError".
    const isAbortError =
      (signal?.aborted === true && cause === signal.reason) ||
      (cause instanceof Error && cause.name === "AbortError");
    if (isAbortError) throw cause;
    throw new TimeoutError(`waitForRequest: predicate not satisfied within ${timeoutMs}ms`, {
      context: { timeoutMs },
      cause,
    });
  }
}

/**
 * Wait for the first response satisfying `predicate`. Thin wrapper over
 * `page.waitForResponse` with the same typed-timeout / abort-passthrough
 * semantics as {@link waitForRequest}.
 */
export async function waitForResponse(
  page: Page,
  predicate: (res: HTTPResponse) => boolean | Promise<boolean>,
  opts: WaitForEventOptions = {},
): Promise<HTTPResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = opts;
  try {
    return await page.waitForResponse(predicate, { timeout: timeoutMs, signal });
  } catch (cause) {
    // Same provenance-based abort guard as `waitForRequest` (see the comment
    // there): match on the thrown error itself, not just signal state, so a
    // genuine timeout that races with an unrelated signal abort still wraps
    // as a retryable TimeoutError instead of being misclassified as a
    // terminal abort passthrough.
    const isAbortError =
      (signal?.aborted === true && cause === signal.reason) ||
      (cause instanceof Error && cause.name === "AbortError");
    if (isAbortError) throw cause;
    throw new TimeoutError(`waitForResponse: predicate not satisfied within ${timeoutMs}ms`, {
      context: { timeoutMs },
      cause,
    });
  }
}
