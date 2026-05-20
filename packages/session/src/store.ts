import { SessionError } from "@technical-1/core";
import type { Page } from "puppeteer-core";
import { captureSession, restoreSession } from "./snapshot.js";
import type { SessionSnapshot } from "./types.js";

/**
 * In-memory label-keyed store of `SessionSnapshot`s. Thin wrapper over the
 * pure `captureSession`/`restoreSession` functions for multi-account flows.
 *
 * Not persisted to disk in v1 — call `JSON.stringify(session.get(label))`
 * yourself if you want filesystem persistence.
 */
export class Session {
  readonly #store = new Map<string, SessionSnapshot>();

  /** Capture `page`'s state and store it under `label`. Returns the snapshot. */
  async save(page: Page, label: string): Promise<SessionSnapshot> {
    const snap = await captureSession(page);
    this.#store.set(label, snap);
    return snap;
  }

  /**
   * Restore the snapshot stored under `label` to `page`.
   *
   * Throws `SessionError` (`retryable:false`) when no snapshot exists for
   * the label.
   */
  async load(page: Page, label: string): Promise<void> {
    const snap = this.#store.get(label);
    if (snap === undefined) {
      throw new SessionError(`No session stored under label: ${label}`, {
        retryable: false,
        context: { label },
      });
    }
    await restoreSession(page, snap);
  }

  /**
   * Synchronous query. Returns `undefined` when no snapshot is stored under
   * `label` — use `load()` instead if you want a `SessionError` thrown on
   * missing labels.
   */
  get(label: string): SessionSnapshot | undefined {
    return this.#store.get(label);
  }

  /** Overwrite the snapshot at `label` (or insert if absent). */
  set(label: string, snapshot: SessionSnapshot): void {
    this.#store.set(label, snapshot);
  }

  /** Returns `true` if a snapshot was removed, `false` if the label was unknown. */
  delete(label: string): boolean {
    return this.#store.delete(label);
  }

  /** Returns a fresh array of stored labels (callers may mutate it freely). */
  list(): string[] {
    return [...this.#store.keys()];
  }
}
