import { NetworkError } from "@technical-1/core";
import type { HTTPRequest, Page } from "puppeteer-core";
import type { BlockPattern } from "./types.js";

interface BlockingState {
  patterns: BlockPattern[];
  listener: (req: HTTPRequest) => Promise<void>;
}

/**
 * Per-page registry of the blocking listener and accumulated patterns. We
 * keep the live patterns array shared with the closure so repeat
 * `blockResources` calls merge into the same listener — avoids double-
 * registration and the puppeteer-core "request already handled" error.
 *
 * Weak so the registry follows the page's lifetime (GC-clean).
 */
const STATE: WeakMap<Page, BlockingState> = new WeakMap();

function matches(req: HTTPRequest, patterns: readonly BlockPattern[]): boolean {
  for (const p of patterns) {
    if (typeof p === "string") {
      if (req.resourceType() === p) return true;
    } else if (p.test(req.url())) {
      return true;
    }
  }
  return false;
}

/**
 * Enable request interception on `page` and abort requests matching any of
 * `patterns`. A `ResourceType` string (e.g. `"image"`, `"stylesheet"`)
 * matches the request's resource type exactly; a `RegExp` matches the
 * request URL.
 *
 * Idempotent across repeat calls — patterns from subsequent calls merge
 * into the live listener.
 *
 * Throws `NetworkError` (`retryable:false`) when called with an empty
 * pattern list (programmer error).
 */
export async function blockResources(
  page: Page,
  patterns: readonly BlockPattern[],
): Promise<void> {
  if (patterns.length === 0) {
    throw new NetworkError("blockResources requires at least one pattern", {
      retryable: false,
    });
  }

  const existing = STATE.get(page);
  if (existing !== undefined) {
    existing.patterns.push(...patterns);
    return;
  }

  const live: BlockPattern[] = [...patterns];
  const listener = async (req: HTTPRequest): Promise<void> => {
    try {
      if (matches(req, live)) await req.abort();
      else await req.continue();
    } catch {
      // Race: request was already handled by another listener — swallow.
      // (Cross-realm safety; puppeteer-core throws on double-handle.)
    }
  };

  await page.setRequestInterception(true);
  page.on("request", listener);
  STATE.set(page, { patterns: live, listener });
}

/**
 * Disable request interception on `page` and detach the blocking listener
 * installed by `blockResources`. Idempotent — safe to call when no
 * interception was active.
 */
export async function unblockResources(page: Page): Promise<void> {
  const state = STATE.get(page);
  if (state === undefined) return;
  page.off("request", state.listener);
  STATE.delete(page);
  await page.setRequestInterception(false);
}
