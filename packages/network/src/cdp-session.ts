import type { CDPSession, Page } from "puppeteer-core";

/**
 * One CDP session per page, reused across ALL CDP-backed helpers in this
 * package (network throttling AND CPU throttling). Creating a fresh session per
 * call (and never detaching) leaks a protocol handle per invocation on
 * long-lived pages. Weak so it follows the page's GC lifetime.
 */
const SESSIONS: WeakMap<Page, CDPSession> = new WeakMap();

/** Obtain the one cached CDP session for `page`, creating it on first use.
 *  Shared by throttle/setOffline (network conditions) and throttleCPU (CPU rate)
 *  so a page has exactly one protocol handle, never one per call. */
export async function getSession(page: Page): Promise<CDPSession> {
  let session = SESSIONS.get(page);
  if (session === undefined) {
    session = await page.target().createCDPSession();
    SESSIONS.set(page, session);
  }
  return session;
}

/** Evict the cached session so the next getSession re-attaches a fresh one.
 *  Call after a send() failure — a stale/detached cached session would make
 *  every subsequent call on the page fail forever. */
export function evictSession(page: Page): void {
  SESSIONS.delete(page);
}
