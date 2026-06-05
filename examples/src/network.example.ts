/**
 * @technical-1/network — blockResources / captureResponses / throttle / setOffline demo
 *
 * Demonstrates request blocking, response capture, and network condition
 * emulation using the frozen THROTTLE_PROFILES presets.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import {
  blockResources,
  unblockResources,
  captureResponses,
  throttle,
  setOffline,
  THROTTLE_PROFILES,
} from "@technical-1/network";
import type { ResponseRecord } from "@technical-1/network";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Block images + analytics URLs ─────────────────────────────────────────
  // BlockPattern accepts ResourceType strings (exact) or RegExp (URL match).
  await blockResources(page, ["image", /google-analytics/]);
  console.log("images and analytics blocked");

  // ── Capture all responses ─────────────────────────────────────────────────
  // captureResponses returns a live collector; call .stop() to unsubscribe.
  const collector = await captureResponses(page);
  // … trigger navigation here in real usage …
  const sample: ResponseRecord | undefined = collector.responses[0];
  if (sample !== undefined) {
    console.log("first response:", sample.url, sample.status);
  }
  collector.stop();
  console.log("total responses captured:", collector.responses.length);

  // ── Throttle to Fast 3G (frozen preset) ───────────────────────────────────
  // THROTTLE_PROFILES is a frozen table — reference it directly rather than
  // constructing a profile literal to keep the code DRY and mistake-proof.
  await throttle(page, THROTTLE_PROFILES.FAST_3G);
  console.log("network throttled to Fast 3G (latency:", THROTTLE_PROFILES.FAST_3G.latency, "ms)");

  // ── Slow 3G for performance regression testing ────────────────────────────
  await throttle(page, THROTTLE_PROFILES.SLOW_3G);
  console.log("network throttled to Slow 3G");

  // ── Toggle offline / restore ──────────────────────────────────────────────
  await setOffline(page, true);
  console.log("page is offline");
  await setOffline(page, false);
  console.log("page is back online");

  // ── Unblock resources when done ───────────────────────────────────────────
  await unblockResources(page);
  console.log("all request interceptors removed");
}
