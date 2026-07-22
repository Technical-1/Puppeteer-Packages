import type { JSHandle } from "puppeteer-core";
import { PptrKitError, TimeoutError } from "@technical-1/core";
import type { LoggerOption, TimeoutOption } from "@technical-1/core";
import type { PageOrFrame } from "./helpers.js";
import { DEFAULT_TIMEOUT } from "./helpers.js";

export interface WaitForFunctionOptions extends LoggerOption, TimeoutOption {
  /** Polling strategy: interval in ms, or "raf" / "mutation". Default: puppeteer's "raf". */
  polling?: number | "raf" | "mutation";
  /** Extra args forwarded to the page function. */
  args?: unknown[];
}

/**
 * Structural view of the `waitForFunction` method shared by `Page` and `Frame`.
 * Casting to this avoids the union-of-overloads friction of calling the method
 * directly on `Page | Frame` (same pattern as `upload.ts`'s `UploadCapable`).
 */
type WaitForFunctionCapable = {
  waitForFunction(
    fn: string | ((...args: unknown[]) => unknown),
    options: { timeout: number; polling?: number | "raf" | "mutation" },
    ...args: unknown[]
  ): Promise<unknown>;
};

/**
 * Poll `pageFunction` in-page until it returns a truthy value, then resolve its
 * `JSHandle`. A poll that never becomes truthy within `timeout` (default
 * {@link DEFAULT_TIMEOUT}) surfaces as a retryable `TimeoutError` carrying the
 * original rejection as `cause`. Works against a `Page` or a `Frame`.
 */
export async function waitForFunction<T = unknown>(
  page: PageOrFrame,
  pageFunction: string | ((...args: unknown[]) => unknown),
  opts: WaitForFunctionOptions = {},
): Promise<JSHandle<T>> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  opts.logger?.log("waitForFunction", "step");
  try {
    const handle = await (page as unknown as WaitForFunctionCapable).waitForFunction(
      pageFunction,
      { timeout, polling: opts.polling },
      ...(opts.args ?? []),
    );
    return handle as JSHandle<T>;
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" ||
        /timeout|exceeded|waiting (for )?function failed/i.test(err.message));
    if (isTimeout) {
      throw new TimeoutError("waitForFunction predicate never became truthy", {
        cause: err,
        context: { timeout },
      });
    }
    throw new PptrKitError("waitForFunction: page function evaluation failed", {
      retryable: false,
      cause: err,
      context: { timeout },
    });
  }
}
