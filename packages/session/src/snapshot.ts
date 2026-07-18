import { SessionError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { SessionSnapshot } from "./types.js";

// In-page globals referenced inside the evaluate callbacks below. Declared
// module-scoped so the file's TypeScript stays Node-only (no DOM lib).
declare var localStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };
declare var sessionStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };
declare var location: { origin: string };

/**
 * Read all cookies + localStorage + sessionStorage from `page`. Returns a
 * plain JSON-serializable snapshot.
 *
 * Cookies come from `page.browserContext().cookies()` — the non-deprecated
 * v24 path. (page-level cookie APIs emit a deprecation warning.)
 *
 * Throws `SessionError` (terminal — `retryable:false`) wrapping any
 * puppeteer-core / page failure as `cause`.
 */
export async function captureSession(page: Page): Promise<SessionSnapshot> {
  try {
    const cookies = await page.browserContext().cookies();
    const storage = await page.evaluate(
      /* v8 ignore next 15 -- runs in-browser; covered by the integration tier */
      () => {
        const dump = (s: typeof localStorage): Record<string, string> => {
          const out: Record<string, string> = {};
          for (let i = 0; i < s.length; i++) {
            const k = s.key(i);
            if (k !== null) {
              const v = s.getItem(k);
              if (v !== null) out[k] = v;
            }
          }
          return out;
        };
        return { local: dump(localStorage), session: dump(sessionStorage), origin: location.origin };
      },
    );

    return {
      cookies,
      localStorage: storage.local,
      sessionStorage: storage.session,
      origin: storage.origin,
      capturedAt: new Date().toISOString(),
    };
  } catch (cause) {
    throw new SessionError("captureSession failed", { cause, retryable: false });
  }
}

/**
 * Apply a `SessionSnapshot` to `page`: sets cookies on `page.browserContext()`
 * (the non-deprecated v24 path) and queues the storage write via
 * `evaluateOnNewDocument` so it lands BEFORE the next navigation. Caller
 * must navigate to `snapshot.origin` to observe the restored storage
 * (browsers scope storage to origin).
 *
 * The injected script early-returns unless the page's live `location.origin`
 * equals `snapshot.origin`, so the restored storage can only ever be written
 * onto its originating origin — a page reused across origins never leaks one
 * origin's storage onto a foreign one.
 *
 * Throws `SessionError` (terminal — `retryable:false`) wrapping any failure.
 */
export async function restoreSession(
  page: Page,
  snapshot: SessionSnapshot,
): Promise<void> {
  try {
    if (snapshot.cookies.length > 0) {
      await page.browserContext().setCookie(...snapshot.cookies);
    }
    await page.evaluateOnNewDocument(
      /* v8 ignore next 5 -- runs in-browser; covered by the integration tier */
      (local: Record<string, string>, session: Record<string, string>, origin: string) => {
        if (location.origin !== origin) return; // never write onto a foreign origin
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      },
      snapshot.localStorage,
      snapshot.sessionStorage,
      snapshot.origin,
    );
  } catch (cause) {
    throw new SessionError(
      `restoreSession failed (cookies: ${snapshot.cookies.length}, localKeys: ${Object.keys(snapshot.localStorage).length}, sessionKeys: ${Object.keys(snapshot.sessionStorage).length})`,
      { cause, retryable: false, context: {
        cookies: snapshot.cookies.length,
        localKeys: Object.keys(snapshot.localStorage).length,
        sessionKeys: Object.keys(snapshot.sessionStorage).length,
      } },
    );
  }
}
