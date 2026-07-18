import type { Page, HTTPResponse } from "puppeteer-core";
import { withRetry, type RetryOptions } from "@technical-1/retry";
import { NavigationError, TimeoutError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

export type WaitUntil =
  | "load"
  | "domcontentloaded"
  | "networkidle0"
  | "networkidle2";

export interface GotoOptions extends LoggerOption {
  /** Puppeteer waitUntil strategy. Default "load". */
  waitUntil?: WaitUntil;
  /** Per-attempt navigation timeout (ms). Default 30000. */
  timeout?: number;
  /** Retry/backoff policy for the navigation (see @technical-1/retry). */
  retry?: RetryOptions;
}

/**
 * Navigate `page` to `url` with retry/backoff. Returns the `HTTPResponse`
 * Puppeteer received, or `null` for same-document navigations, `about:blank`,
 * or when the main-frame request is intercepted/aborted before a response arrives.
 *
 * Contract: "navigated" means `page.goto` did not network-error (DNS,
 * timeout, connection refused). An HTTP 4xx/5xx response does NOT fail
 * navigation — Puppeteer resolves on any received response. Gate on status
 * via the returned response: `const res = await goto(page, url); res?.status()`.
 *
 * A failure that survives all retries is rethrown as a `core`
 * `NavigationError` carrying the url + cause. That `NavigationError` has
 * `retryable: true`, so a caller wrapping `goto` in an OUTER retry policy
 * will re-attempt (outer × inner total attempts) — pass a terminal outer
 * policy if that is not desired.
 */
export async function goto(
  page: Page,
  url: string,
  opts: GotoOptions = {},
): Promise<HTTPResponse | null> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(`navigating to ${url}`, "step");
  let response: HTTPResponse | null = null;
  try {
    response = await withRetry(
      async () => page.goto(url, { waitUntil, timeout }),
      {
        logger: opts.logger,
        isRetryable: () => true,
        ...opts.retry,
      },
    );
  } catch (err) {
    // A caller-cancelled navigation (aborted retry.signal) surfaces from
    // withRetry as a plain Error("Aborted…"). Do NOT rewrap it as a retryable
    // NavigationError — that would let an outer retry policy re-attempt a
    // navigation the caller explicitly cancelled. Pass the abort through as-is
    // (terminal: a plain Error carries no `retryable`, so the suite property
    // contract reads it as non-retryable).
    //
    // Detection must be based on the ERROR'S PROVENANCE, not just current
    // signal state: checking only `opts.retry?.signal?.aborted` admits a race
    // where a caller aborts the signal for an unrelated reason at the same
    // moment withRetry throws a genuine, retry-exhausted `fn()` failure (which
    // withRetry rethrows as-is without consulting the signal). In that race, a
    // state-only check would misclassify the genuine failure as a terminal
    // abort instead of wrapping it as a retryable NavigationError. Match on
    // the exact message shapes withRetry uses for abort ("Aborted before
    // first attempt" / "Aborted" during backoff), requiring the signal to
    // also be aborted as a belt-and-suspenders check.
    const isAbortError =
      err instanceof Error &&
      err.message.startsWith("Aborted") &&
      opts.retry?.signal?.aborted === true;
    if (isAbortError) throw err;
    throw new NavigationError(url, { cause: err, context: { url, waitUntil } });
  }
  opts.logger?.log(`loaded ${url}`, "success");
  return response;
}

export interface NetworkIdleOptions extends LoggerOption {
  /** Quiet window before considering the network idle (ms). Default 500. */
  idleTime?: number;
  /** Overall timeout (ms). Default 30000. */
  timeout?: number;
}

/**
 * Wait for the SPA's network to go idle (delegates to puppeteer-core). A
 * timeout is rewrapped as a core `TimeoutError` (retryable:true) so the failure
 * surface matches `goto` and the rest of the suite; the raw puppeteer error is
 * preserved as `cause`.
 */
export async function waitForNetworkIdle(
  page: Page,
  opts: NetworkIdleOptions = {},
): Promise<void> {
  const idleTime = opts.idleTime ?? 500;
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(
    `waiting for network idle (idleTime ${idleTime}ms, timeout ${timeout}ms)`,
    "step",
  );
  try {
    await page.waitForNetworkIdle({ idleTime, timeout });
  } catch (err) {
    opts.logger?.log(
      `network idle wait failed: ${err instanceof Error ? err.message : String(err)}`,
      "error",
    );
    throw new TimeoutError(
      `waitForNetworkIdle: network did not idle within ${timeout}ms`,
      { cause: err, context: { idleTime, timeout } },
    );
  }
}
