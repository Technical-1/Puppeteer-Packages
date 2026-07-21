import { NetworkError } from "@technical-1/core";
import type { HTTPRequest, Page } from "puppeteer-core";
import type { BlockPattern } from "./types.js";
import type { InterceptDecision } from "./interception.js";
import { registerInterceptor, teardownIfEmpty } from "./interception.js";

interface BlockingState {
  /** Live patterns array shared with the registered interceptor closure. */
  patterns: BlockPattern[];
  /** Removes the blocking interceptor from the shared coordinator. */
  dispose: () => void;
}

/**
 * Per-page blocking registry. Repeat `blockResources` calls merge patterns into
 * the SAME live array (and the same single registered interceptor) — no second
 * interceptor, no second `setRequestInterception`. Weak so it follows the page's
 * GC lifetime.
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
 * `patterns`. A `ResourceType` string (e.g. `"image"`, `"stylesheet"`) matches
 * the request's resource type exactly; a `RegExp` matches the request URL.
 * Idempotent across repeat calls — patterns merge into the live interceptor.
 * Composes with `mockRequests` on the same page through the shared interception
 * coordinator.
 *
 * Throws `NetworkError` (`retryable:false`) when called with an empty pattern
 * list (programmer error).
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
  const dispose = await registerInterceptor(page, (req): InterceptDecision =>
    matches(req, live) ? { action: "abort" } : undefined,
  );
  STATE.set(page, { patterns: live, dispose });
}

/**
 * Disable the blocking interceptor installed by `blockResources`. If no other
 * interception consumer remains on `page`, request interception is turned off.
 * Idempotent — safe when no blocking was active.
 */
export async function unblockResources(page: Page): Promise<void> {
  const state = STATE.get(page);
  if (state === undefined) return;
  state.dispose();
  STATE.delete(page);
  await teardownIfEmpty(page);
}
