import type { Page, HTTPResponse } from "puppeteer-core";
import { withRetry, type RetryOptions } from "@technical-1/retry";
import { NavigationError, TimeoutError } from "@technical-1/core";
import type { LoggerOption, Logger, ErrorContext } from "@technical-1/core";

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
/**
 * Shared control flow for goto/navigateOnGesture: run `fn` under `withRetry`
 * (every fn failure is retryable — the retry policy governs attempts), pass a
 * caller-cancellation through untouched so an outer retry policy never
 * re-attempts a navigation the caller cancelled, and wrap any other surviving
 * failure as a retryable `NavigationError`.
 *
 * Abort detection keys off the cross-realm-safe `err.name === "AbortError"`
 * check — not `instanceof`, which is unreliable across the dual ESM/CJS
 * package boundary (a consumer can resolve retry's and navigation's copies
 * of `@technical-1/core` as two different modules, giving two different
 * `AbortError` classes) — and not the current signal state. That name check
 * is why a genuine retry-exhausted failure that merely races with an
 * unrelated signal abort still wraps as `NavigationError`: withRetry's
 * retry-exhaustion path rethrows the real `fn()` failure as-is (name
 * `"Error"`, not `"AbortError"`), so it fails the guard and gets wrapped,
 * exactly as intended.
 */
async function runNavigation(
  fn: (attempt: number) => Promise<HTTPResponse | null>,
  opts: {
    errorUrl: string;
    context: ErrorContext;
    retry?: RetryOptions;
    logger?: Logger;
  },
): Promise<HTTPResponse | null> {
  try {
    return await withRetry(fn, {
      logger: opts.logger,
      isRetryable: () => true,
      ...opts.retry,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new NavigationError(opts.errorUrl, {
      cause: err,
      context: opts.context,
    });
  }
}

export async function goto(
  page: Page,
  url: string,
  opts: GotoOptions = {},
): Promise<HTTPResponse | null> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(`navigating to ${url}`, "step");
  const response = await runNavigation(
    async () => page.goto(url, { waitUntil, timeout }),
    {
      errorUrl: url,
      context: { url, waitUntil },
      retry: opts.retry,
      logger: opts.logger,
    },
  );
  opts.logger?.log(`loaded ${url}`, "success");
  return response;
}

export interface GestureNavigationOptions extends LoggerOption {
  /** Lifecycle event to wait for after the gesture. Default "load". */
  waitUntil?: WaitUntil;
  /** Per-attempt navigation timeout (ms). Default 30000. */
  timeout?: number;
  /** Retry/backoff policy for the gesture navigation (see @technical-1/retry). */
  retry?: RetryOptions;
}

/**
 * Run `gesture` (e.g. a click on a link/submit button) and wait for the
 * navigation it triggers, racing `page.waitForNavigation` against the gesture
 * with `Promise.all` so the navigation listener is armed before the click fires.
 * Returns the `HTTPResponse` Puppeteer received, or `null` for same-document
 * navigations / when no response arrives.
 *
 * Uses the SAME per-attempt timeout + `withRetry` wrapping as `goto`. A failure
 * that survives all retries is rethrown as a core `NavigationError` (retryable)
 * carrying the originating URL + cause. A caller-cancelled navigation (aborted
 * `opts.retry.signal`) is passed through as-is (terminal), never rewrapped.
 */
export async function navigateOnGesture(
  page: Page,
  gesture: () => unknown | Promise<unknown>,
  opts: GestureNavigationOptions = {},
): Promise<HTTPResponse | null> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  const from = page.url();
  opts.logger?.log(`awaiting gesture navigation from ${from}`, "step");
  const response = await runNavigation(
    async () => {
      const [res] = await Promise.all([
        page.waitForNavigation({ waitUntil, timeout }),
        gesture(),
      ]);
      return res;
    },
    {
      errorUrl: from,
      context: { from, waitUntil },
      retry: opts.retry,
      logger: opts.logger,
    },
  );
  opts.logger?.log(`gesture navigation settled from ${from}`, "success");
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
