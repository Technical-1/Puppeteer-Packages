import { SessionError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import type { SessionSnapshot } from "./types.js";

// In-page globals referenced inside the evaluate callbacks below. Declared
// module-scoped so the file's TypeScript stays Node-only (no DOM lib).
declare var localStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };
declare var sessionStorage: { length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void };

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
    const storage = await page.evaluate(() => {
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
      return { local: dump(localStorage), session: dump(sessionStorage) };
    });

    return {
      cookies,
      localStorage: storage.local,
      sessionStorage: storage.session,
      capturedAt: new Date().toISOString(),
    };
  } catch (cause) {
    throw new SessionError("captureSession failed", { cause });
  }
}

/**
 * Apply a `SessionSnapshot` to `page`: sets cookies on `page.browserContext()`
 * (the non-deprecated v24 path) and queues the storage write via
 * `evaluateOnNewDocument` so it lands BEFORE the next navigation. Caller
 * must navigate to a matching origin to observe the restored storage
 * (browsers scope storage to origin).
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
      (local: Record<string, string>, session: Record<string, string>) => {
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      },
      snapshot.localStorage,
      snapshot.sessionStorage,
    );
  } catch (cause) {
    throw new SessionError("restoreSession failed", { cause });
  }
}
