import type { Dialog, Page } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";
import type {
  DialogDisposition,
  DialogEvent,
  DialogKind,
  DialogPolicy,
} from "./types.js";

export interface HandleDialogsOptions extends LoggerOption {
  /** Per-kind overrides. Kinds omitted here use `defaultAction`. */
  policy?: DialogPolicy;
  /** Action for any dialog kind not covered by `policy`. Default "dismiss". */
  defaultAction?: DialogDisposition;
}

export interface DialogHandler {
  /** Every dialog handled so far, in order. */
  readonly handled: readonly DialogEvent[];
  /** Detach the 'dialog' listener. Idempotent. */
  dispose(): void;
}

/**
 * Attach a `page.on('dialog', …)` handler that auto-responds to alert/confirm/
 * prompt/beforeunload dialogs. Returns a disposer; call `dispose()` to detach.
 *
 * The listener is synchronous (it schedules an async response with `void`) so it
 * never returns a promise to puppeteer's EventEmitter.
 */
export function handleDialogs(
  page: Page,
  opts: HandleDialogsOptions = {},
): DialogHandler {
  const defaultAction: DialogDisposition = opts.defaultAction ?? "dismiss";
  const handled: DialogEvent[] = [];
  let disposed = false;

  const respond = async (dialog: Dialog): Promise<void> => {
    const type = dialog.type() as DialogKind;
    const rule = opts.policy?.[type];
    const action: DialogDisposition = rule?.action ?? defaultAction;
    if (action === "accept") {
      await dialog.accept(undefined);
    } else {
      await dialog.dismiss();
    }
  };

  const listener = (dialog: Dialog): void => {
    void respond(dialog);
  };

  page.on("dialog", listener);

  return {
    handled,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      page.off("dialog", listener);
    },
  };
}
