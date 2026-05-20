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
  /** ISO-8601 capture timestamp — informational only. */
  capturedAt: string;
}
