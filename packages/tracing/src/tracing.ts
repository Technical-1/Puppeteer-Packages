import { PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type { Page, TracingOptions } from "puppeteer-core";

/** Options for {@link traceRun}. Fields map onto puppeteer's `TracingOptions`. */
export interface TraceOptions extends LoggerOption {
  /** DevTools trace categories to record (e.g. `["devtools.timeline"]`). */
  categories?: string[];
  /** Capture screenshots into the trace timeline. */
  screenshots?: boolean;
  /**
   * If set, puppeteer-core writes the trace JSON to this path in addition to
   * returning the buffer. The file write is owned by puppeteer-core, not this package.
   */
  path?: string;
}

/** The result of a {@link traceRun}: your function's value plus the captured trace. */
export interface TraceResult<T> {
  /** Whatever `fn` returned. */
  value: T;
  /** The captured DevTools trace buffer. */
  trace: Uint8Array;
  /** The path the trace was also written to, if `options.path` was supplied. */
  path?: string;
}

/**
 * Start a DevTools performance trace, run `fn`, then **always** stop the trace,
 * returning the captured buffer with `fn`'s value.
 */
export async function traceRun<T>(
  page: Page,
  fn: (page: Page) => Promise<T> | T,
  options: TraceOptions = {}
): Promise<TraceResult<T>> {
  const { logger, categories, screenshots, path } = options;

  const tracingOptions: TracingOptions = {};
  if (categories !== undefined) tracingOptions.categories = categories;
  if (screenshots !== undefined) tracingOptions.screenshots = screenshots;
  if (path !== undefined) tracingOptions.path = path;

  await page.tracing.start(tracingOptions);

  let value: T;
  let buffer: Uint8Array | undefined;
  let fnError: unknown;
  let threw = false;
  try {
    value = await fn(page);
  } catch (err) {
    threw = true;
    fnError = err;
  }

  try {
    buffer = await page.tracing.stop();
  } catch (stopCause) {
    if (threw) {
      // Do not mask fn's original error; surface the stop failure via the logger only.
      logger?.log("traceRun: tracing.stop failed during error unwind", "warn");
    } else {
      throw new PptrKitError("traceRun: tracing.stop failed", {
        retryable: true,
        cause: stopCause,
      });
    }
  }

  if (threw) throw fnError;

  if (buffer === undefined) {
    throw new PptrKitError("traceRun: tracing produced no buffer", {
      retryable: true,
    });
  }
  const result: TraceResult<T> = { value: value!, trace: buffer };
  if (path !== undefined) result.path = path;
  return result;
}
