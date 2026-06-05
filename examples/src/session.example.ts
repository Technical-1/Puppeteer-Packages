/**
 * @technical-1/session — captureSession / restoreSession / Session store demo
 *
 * Demonstrates capturing and restoring browser session state (cookies +
 * localStorage + sessionStorage) across pages, and the label-keyed in-memory
 * store for multi-account workflows.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 */

import { captureSession, restoreSession, Session } from "@technical-1/session";
import type { SessionSnapshot } from "@technical-1/session";
import type { Page } from "puppeteer-core";

// ── Primary demo: capture / restore ──────────────────────────────────────────
export async function demo(page: Page): Promise<void> {
  // captureSession reads cookies (from browserContext) + localStorage +
  // sessionStorage. The snapshot is plain JSON-serializable data.
  const snap: SessionSnapshot = await captureSession(page);
  console.log("cookies captured:", snap.cookies.length);
  console.log("localStorage keys:", Object.keys(snap.localStorage).length);
  console.log("capturedAt:", snap.capturedAt);

  // restoreSession applies cookies to the browserContext and queues storage
  // writes via evaluateOnNewDocument — navigate to a matching origin to observe.
  await restoreSession(page, snap);
  console.log("session restored — navigate to matching origin to observe storage");
}

// ── Secondary demo: Session store — multi-account workflows ──────────────────
// The Session class is a label-keyed in-memory store layered on top of
// captureSession / restoreSession; useful for rotating between accounts.
export async function demoStore(
  loginPage: Page,
  targetPage: Page,
): Promise<void> {
  const store = new Session();

  // Save alice's session snapshot under the label "alice".
  const saved = await store.save(loginPage, "alice");
  console.log("saved snapshot for alice at:", saved.capturedAt);

  // Inspect stored labels without loading.
  console.log("stored labels:", store.list());
  // => ["alice"]

  // Load alice's snapshot onto a fresh page.
  await store.load(targetPage, "alice");
  console.log("alice session loaded onto targetPage");

  // Synchronous get — returns undefined when label is absent.
  const lookup = store.get("alice");
  console.log("get cookies:", lookup?.cookies.length ?? "(not found)");
}
