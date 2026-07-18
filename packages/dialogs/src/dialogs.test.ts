import { describe, it, expect, vi } from "vitest";
import type { Dialog, Page } from "puppeteer-core";
import { handleDialogs } from "./dialogs.js";
import type { DialogKind } from "./types.js";

/** Flush microtasks + the current macrotask so the async responder settles. */
const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

/** Page mock that captures the sync 'dialog' listener and lets a test fire it. */
function pageMock(): {
  page: Page;
  fire: (dialog: Dialog) => void;
  off: ReturnType<typeof vi.fn>;
} {
  let handler: ((dialog: Dialog) => void) | undefined;
  const off = vi.fn();
  const on = vi.fn((event: string, fn: (dialog: Dialog) => void) => {
    if (event === "dialog") handler = fn;
  });
  const page = { on, off } as unknown as Page;
  return {
    page,
    fire: (dialog) => handler?.(dialog),
    off,
  };
}

function dialogMock(over: {
  type?: DialogKind;
  message?: string;
  defaultValue?: string;
} = {}): Dialog {
  return {
    type: vi.fn().mockReturnValue(over.type ?? "confirm"),
    message: vi.fn().mockReturnValue(over.message ?? "Are you sure?"),
    defaultValue: vi.fn().mockReturnValue(over.defaultValue ?? ""),
    accept: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
  } as unknown as Dialog;
}

describe("handleDialogs — default action", () => {
  it("dismisses a confirm dialog by default", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page);
    const dialog = dialogMock({ type: "confirm" });

    fire(dialog);
    await flush();

    expect(dialog.dismiss).toHaveBeenCalledTimes(1);
    expect(dialog.accept).not.toHaveBeenCalled();
  });

  it("accepts a confirm dialog when defaultAction is 'accept'", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, { defaultAction: "accept" });
    const dialog = dialogMock({ type: "confirm" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith(undefined);
    expect(dialog.dismiss).not.toHaveBeenCalled();
  });
});

describe("handleDialogs — per-type policy", () => {
  it("uses the policy action for the matching kind", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, {
      defaultAction: "dismiss",
      policy: { confirm: { action: "accept" } },
    });
    const dialog = dialogMock({ type: "confirm" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith(undefined);
  });

  it("falls back to defaultAction for kinds absent from the policy", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, {
      defaultAction: "accept",
      policy: { confirm: { action: "dismiss" } },
    });
    const alert = dialogMock({ type: "alert" });

    fire(alert);
    await flush();

    expect(alert.accept).toHaveBeenCalledWith(undefined);
    expect(alert.dismiss).not.toHaveBeenCalled();
  });
});
