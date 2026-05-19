import type { Page } from "puppeteer-core";
import { withRetry, type RetryOptions } from "@technical-1/retry";
import { NavigationError } from "@technical-1/core";
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
 * Navigate `page` to `url` with retry/backoff.
 *
 * Contract: "navigated" means `page.goto` did not network-error (DNS,
 * timeout, connection refused). An HTTP 4xx/5xx response does NOT fail
 * navigation — Puppeteer resolves on any received response. If you need to
 * gate on HTTP status, inspect the page after `goto` returns.
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
): Promise<void> {
  const waitUntil = opts.waitUntil ?? "load";
  const timeout = opts.timeout ?? 30000;
  opts.logger?.log(`navigating to ${url}`, "step");
  try {
    await withRetry(
      async () => {
        await page.goto(url, { waitUntil, timeout });
      },
      {
        logger: opts.logger,
        isRetryable: () => true,
        ...opts.retry,
      },
    );
  } catch (err) {
    throw new NavigationError(url, { cause: err, context: { url, waitUntil } });
  }
  opts.logger?.log(`loaded ${url}`, "success");
}

export interface NetworkIdleOptions {
  /** Quiet window before considering the network idle (ms). Default 500. */
  idleTime?: number;
  /** Overall timeout (ms). Default 30000. */
  timeout?: number;
}

/** Wait for the SPA's network to go idle (delegates to puppeteer-core). */
export async function waitForNetworkIdle(
  page: Page,
  opts: NetworkIdleOptions = {},
): Promise<void> {
  await page.waitForNetworkIdle({
    idleTime: opts.idleTime ?? 500,
    timeout: opts.timeout ?? 30000,
  });
}
