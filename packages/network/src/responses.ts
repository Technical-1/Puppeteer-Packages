import type { HTTPResponse, Page, ResourceType } from "puppeteer-core";
import type { ResponseCollector, ResponseRecord } from "./types.js";

export interface CaptureResponsesOptions {
  /** Optional allow-list of resource types. Omit to capture everything. */
  include?: readonly ResourceType[];
}

/**
 * Subscribe to `page.on('response', …)` and record a minimal summary of each
 * response. Returns a `ResponseCollector` whose `responses` array is mutable
 * (read at any time) and whose `stop()` detaches the listener.
 *
 * v1 records `{url, status, method, resourceType, timestamp}` only — no
 * headers, no bodies. Full HAR-1.2 emission is the v2 surface (spec §5).
 */
export async function captureResponses(
  page: Page,
  opts: CaptureResponsesOptions = {},
): Promise<ResponseCollector> {
  const include = opts.include;
  const records: ResponseRecord[] = [];

  const listener = (res: HTTPResponse): void => {
    const req = res.request();
    const resourceType = req.resourceType();
    if (include !== undefined && !include.includes(resourceType)) return;
    records.push({
      url: res.url(),
      status: res.status(),
      method: req.method(),
      resourceType,
      timestamp: Date.now(),
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
