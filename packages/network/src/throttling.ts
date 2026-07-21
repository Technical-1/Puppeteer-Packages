import { NetworkError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { ThrottleProfile } from "./types.js";
import { evictSession, getSession } from "./cdp-session.js";

/**
 * Canonical Chrome DevTools network condition presets.
 *
 * Throughput is in bytes/sec; `-1` disables throttling on that axis.
 * Values match the DevTools UI dropdown ("Slow 3G", "Fast 3G", etc.) —
 * see https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions
 *
 * Frozen so callers can't accidentally mutate them.
 */
export const THROTTLE_PROFILES = Object.freeze({
  OFFLINE: Object.freeze<ThrottleProfile>({
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  }),
  NO_THROTTLE: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  }),
  SLOW_3G: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  }),
  FAST_3G: Object.freeze<ThrottleProfile>({
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  }),
});

export type ThrottleProfileName = keyof typeof THROTTLE_PROFILES;

/**
 * Emulate `profile`'s network conditions on `page` via CDP. Throws
 * `NetworkError` (`retryable:true` — the failure mode is usually a closed
 * session that succeeds after a fresh page) wrapping the underlying error
 * as `cause`.
 */
export async function throttle(page: Page, profile: ThrottleProfile): Promise<void> {
  try {
    const cdp = await getSession(page);
    await cdp.send("Network.emulateNetworkConditions", profile);
  } catch (cause) {
    // Evict the cached session so a retry re-creates a fresh one instead of
    // reusing a session that may have detached — otherwise a stale cached
    // session makes every subsequent call on this page fail forever, which
    // undermines the retryable:true contract below.
    evictSession(page);
    throw new NetworkError("throttle failed", { retryable: true, cause });
  }
}

/**
 * Toggle offline emulation on `page`. Convenience over `throttle` with the
 * `OFFLINE` / `NO_THROTTLE` profiles.
 */
export async function setOffline(page: Page, offline: boolean): Promise<void> {
  await throttle(
    page,
    offline ? THROTTLE_PROFILES.OFFLINE : THROTTLE_PROFILES.NO_THROTTLE,
  );
}
