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
    if (signal?.aborted) throw cause;
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
    if (signal?.aborted) throw cause;
    throw new TimeoutError(`waitForResponse: predicate not satisfied within ${timeoutMs}ms`, {
      context: { timeoutMs },
      cause,
    });
  }
}
