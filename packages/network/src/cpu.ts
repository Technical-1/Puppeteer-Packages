import { NetworkError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";
import { evictSession, getSession } from "./cdp-session.js";

export type ThrottleCPUOptions = LoggerOption;

/**
 * Throttle `page`'s CPU via CDP `Emulation.setCPUThrottlingRate({ rate })`.
 * `rate` is a slowdown multiplier: `1` = no throttle, `4` = 4x slower. Reuses
 * the shared per-page CDP session (no new session per call). Throws
 * `NetworkError` (`retryable:false`) for `rate < 1` (programmer error) and
 * `NetworkError` (`retryable:true`, `cause` set) on a CDP send failure, evicting
 * the cached session so a retry re-attaches.
 */
export async function throttleCPU(
  page: Page,
  rate: number,
  opts: ThrottleCPUOptions = {},
): Promise<void> {
  if (!(rate >= 1)) {
    throw new NetworkError("throttleCPU rate must be >= 1 (1 = no throttle)", {
      retryable: false,
      context: { rate },
    });
  }
  const { logger } = opts;
  try {
    const cdp = await getSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    logger?.log(`throttleCPU: rate=${rate}`, "debug");
  } catch (cause) {
    evictSession(page);
    throw new NetworkError("throttleCPU failed", { retryable: true, cause });
  }
}
