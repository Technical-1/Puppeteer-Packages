import { PptrKitError } from "@technical-1/core";
import type { HTTPResponse, Page, ResourceType } from "puppeteer-core";
import type { ResponseCollector, ResponseRecord } from "./types.js";

export interface CaptureResponsesOptions {
  /** Optional allow-list of resource types. Omit to capture everything. */
  include?: readonly ResourceType[];
  /**
   * Enable lazy body access on captured records. `true` enables it for every
   * captured response; an array gates it to those resource types
   * (e.g. `["xhr","fetch"]` to grab only API payloads). Omit/`false` to disable —
   * calling `buffer()`/`text()`/`json()` then throws a terminal `PptrKitError`.
   */
  body?: boolean | readonly ResourceType[];
}

function bodyEnabledFor(
  body: CaptureResponsesOptions["body"],
  resourceType: ResourceType,
): boolean {
  if (body === true) return true;
  if (Array.isArray(body)) return body.includes(resourceType);
  return false;
}

/**
 * Build the lazy, cached body accessors for one response. When `enabled` is
 * false every accessor throws a terminal `PptrKitError` (body capture was not
 * requested for this resource type). Otherwise the raw body is pulled from the
 * live `HTTPResponse` on first `await` and cached.
 */
function makeBodyAccessors(
  res: HTTPResponse,
  enabled: boolean,
  resourceType: ResourceType,
): Pick<ResponseRecord, "buffer" | "text" | "json"> {
  let cached: Uint8Array | undefined;

  async function buffer(): Promise<Uint8Array> {
    if (!enabled) {
      throw new PptrKitError(
        `Response body capture not enabled for resourceType "${resourceType}" ` +
          `(pass { body: true } or include it in the body gate)`,
        { retryable: false, context: { resourceType } },
      );
    }
    if (cached !== undefined) return cached;
    try {
      cached = await res.buffer();
      return cached;
    } catch (cause) {
      throw new PptrKitError("Response body read failed", {
        retryable: true,
        context: { url: res.url(), resourceType },
        cause,
      });
    }
  }

  async function text(): Promise<string> {
    return new TextDecoder().decode(await buffer());
  }

  async function json(): Promise<unknown> {
    const raw = await text();
    try {
      return JSON.parse(raw) as unknown;
    } catch (cause) {
      throw new PptrKitError("Response body is not valid JSON", {
        retryable: false,
        context: { url: res.url(), resourceType },
        cause,
      });
    }
  }

  return { buffer, text, json };
}

/**
 * Subscribe to `page.on('response', …)` and record a summary of each response.
 * Returns a `ResponseCollector` whose `responses` array is a live, read-only
 * snapshot and whose `stop()` detaches the listener.
 *
 * `headers` and `fromCache` are captured eagerly (both synchronous on
 * `HTTPResponse`). Response bodies are NOT pulled eagerly: `buffer()`/`text()`/
 * `json()` fetch lazily on first `await`, gated by the `body` option, and cache
 * the result. A body must be awaited before the page navigates away.
 *
 * Synchronous — `page.on` is the only side effect; no awaited setup.
 */
export function captureResponses(
  page: Page,
  opts: CaptureResponsesOptions = {},
): ResponseCollector {
  const { include, body } = opts;
  const records: ResponseRecord[] = [];

  const listener = (res: HTTPResponse): void => {
    const req = res.request();
    const resourceType = req.resourceType();
    if (include !== undefined && !include.includes(resourceType)) return;
    const accessors = makeBodyAccessors(res, bodyEnabledFor(body, resourceType), resourceType);
    records.push({
      url: res.url(),
      status: res.status(),
      method: req.method(),
      resourceType,
      headers: res.headers(),
      fromCache: res.fromCache(),
      timestamp: Date.now(),
      ...accessors,
    });
  };

  page.on("response", listener);
  let stopped = false;

  return {
    responses: records,
    stop(): void {
      if (stopped) return;
      stopped = true;
      page.off("response", listener);
    },
  };
}
