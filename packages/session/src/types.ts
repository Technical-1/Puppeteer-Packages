import type { Cookie } from "puppeteer-core";

/**
 * Snapshot of a page's persistent state. Plain data — JSON-serializable.
 *
 * v1 captures cookies + localStorage + sessionStorage. See README for the
 * list of state intentionally NOT captured.
 */
export interface SessionSnapshot {
  cookies: Cookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  /**
   * Origin (scheme://host[:port]) the storage was captured from. `restoreSession`
   * only writes storage when the page's current `location.origin` matches this,
   * so a restored snapshot never leaks storage onto a foreign origin.
   */
  origin: string;
  /** ISO-8601 capture timestamp — informational only. */
  capturedAt: string;
}
