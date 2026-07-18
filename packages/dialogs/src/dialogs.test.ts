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

describe("handleDialogs — prompt text", () => {
  it("passes the per-rule promptText when accepting a prompt", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, {
      policy: { prompt: { action: "accept", promptText: "hello" } },
    });
    const dialog = dialogMock({ type: "prompt" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith("hello");
  });

  it("falls back to opts.promptText when the rule has none", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, {
      defaultAction: "accept",
      promptText: "fallback",
    });
    const dialog = dialogMock({ type: "prompt" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith("fallback");
  });

  it("never passes promptText to a non-prompt dialog", async () => {
    const { page, fire } = pageMock();
    handleDialogs(page, { defaultAction: "accept", promptText: "nope" });
    const dialog = dialogMock({ type: "confirm" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith(undefined);
  });
});

describe("handleDialogs — typed events", () => {
  it("appends a DialogEvent to handled and calls onDialog", async () => {
    const { page, fire } = pageMock();
    const onDialog = vi.fn();
    const handler = handleDialogs(page, {
      defaultAction: "accept",
      policy: { prompt: { action: "accept", promptText: "x" } },
      onDialog,
    });
    const dialog = dialogMock({
      type: "prompt",
      message: "Name?",
      defaultValue: "Jo",
    });

    fire(dialog);
    await flush();

    const event = {
      type: "prompt",
      message: "Name?",
      defaultValue: "Jo",
      action: "accept",
      promptText: "x",
    };
    expect(handler.handled).toEqual([event]);
    expect(onDialog).toHaveBeenCalledWith(event);
  });

  it("omits promptText from the event for non-prompt dialogs", async () => {
    const { page, fire } = pageMock();
    const handler = handleDialogs(page, { defaultAction: "dismiss" });
    const dialog = dialogMock({ type: "alert", message: "Hi" });

    fire(dialog);
    await flush();

    expect(handler.handled).toEqual([
      { type: "alert", message: "Hi", defaultValue: "", action: "dismiss" },
    ]);
    expect(handler.handled[0]).not.toHaveProperty("promptText");
  });

  it("logs a step line through the injected logger", async () => {
    const { page, fire } = pageMock();
    const log = vi.fn();
    handleDialogs(page, { defaultAction: "dismiss", logger: { log } });
    const dialog = dialogMock({ type: "confirm", message: "Sure?" });

    fire(dialog);
    await flush();

    expect(log).toHaveBeenCalledWith(
      'dialogs: dismissed confirm "Sure?"',
      "step",
    );
  });
});

describe("handleDialogs — response failure", () => {
  it("surfaces a retryable PptrKitError via onError and logger, no handled entry", async () => {
    const { page, fire } = pageMock();
    const onError = vi.fn();
    const onDialog = vi.fn();
    const log = vi.fn();
    const handler = handleDialogs(page, {
      defaultAction: "accept",
      onError,
      onDialog,
      logger: { log },
    });
    const dialog = {
      type: vi.fn().mockReturnValue("confirm"),
      message: vi.fn().mockReturnValue("boom"),
      defaultValue: vi.fn().mockReturnValue(""),
      accept: vi.fn().mockRejectedValue(new Error("page closed")),
      dismiss: vi.fn().mockResolvedValue(undefined),
    } as unknown as Dialog;

    fire(dialog);
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as {
      name: string;
      retryable: boolean;
      message: string;
      cause?: unknown;
      context: Record<string, unknown>;
    };
    expect(err.name).toBe("PptrKitError");
    expect(err.retryable).toBe(true);
    expect(err.message).toBe("dialogs: failed to accept confirm dialog");
    expect(err.context).toEqual({ type: "confirm", action: "accept" });
    expect((err.cause as Error).message).toBe("page closed");
    expect(log).toHaveBeenCalledWith(err.message, "error");
    expect(onDialog).not.toHaveBeenCalled();
    expect(handler.handled).toEqual([]);
  });

  it("routes a dismiss() rejection to onError as a retryable PptrKitError, no handled entry", async () => {
    const { page, fire } = pageMock();
    const onError = vi.fn();
    const onDialog = vi.fn();
    const log = vi.fn();
    const handler = handleDialogs(page, {
      defaultAction: "dismiss",
      onError,
      onDialog,
      logger: { log },
    });
    const dialog = {
      type: vi.fn().mockReturnValue("alert"),
      message: vi.fn().mockReturnValue("uh oh"),
      defaultValue: vi.fn().mockReturnValue(""),
      accept: vi.fn().mockResolvedValue(undefined),
      dismiss: vi.fn().mockRejectedValue(new Error("target closed")),
    } as unknown as Dialog;

    fire(dialog);
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as {
      name: string;
      retryable: boolean;
      message: string;
      context: Record<string, unknown>;
    };
    expect(err.name).toBe("PptrKitError");
    expect(err.retryable).toBe(true);
    expect(err.message).toBe("dialogs: failed to dismiss alert dialog");
    expect(err.context).toEqual({ type: "alert", action: "dismiss" });
    expect(log).toHaveBeenCalledWith(err.message, "error");
    expect(onDialog).not.toHaveBeenCalled();
    expect(handler.handled).toEqual([]);
  });

  it("logs the error and does not throw/reject when opts.onError is not supplied", async () => {
    const { page, fire } = pageMock();
    const log = vi.fn();
    const handler = handleDialogs(page, {
      defaultAction: "accept",
      logger: { log },
    });
    const dialog = {
      type: vi.fn().mockReturnValue("confirm"),
      message: vi.fn().mockReturnValue("boom"),
      defaultValue: vi.fn().mockReturnValue(""),
      accept: vi.fn().mockRejectedValue(new Error("page closed")),
      dismiss: vi.fn().mockResolvedValue(undefined),
    } as unknown as Dialog;

    // No try/catch here: if the missing-onError branch ever throws or leaves
    // an unhandled rejection, flush()/the test itself will fail.
    fire(dialog);
    await flush();

    expect(log).toHaveBeenCalledWith(
      "dialogs: failed to accept confirm dialog",
      "error",
    );
    expect(handler.handled).toEqual([]);
  });

  it("routes a throwing onDialog consumer callback to onError, no unhandled rejection", async () => {
    const { page, fire } = pageMock();
    const onError = vi.fn();
    const log = vi.fn();
    const handler = handleDialogs(page, {
      defaultAction: "accept",
      onDialog: () => {
        throw new Error("consumer boom");
      },
      onError,
      logger: { log },
    });
    const dialog = dialogMock({ type: "confirm", message: "Sure?" });

    // A throwing consumer callback must be caught inside respond() and routed
    // to onError — never escape the fire-and-forget listener as an unhandled
    // rejection (which would fail this test).
    fire(dialog);
    await flush();

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as {
      name: string;
      retryable: boolean;
      message: string;
      cause?: unknown;
      context: Record<string, unknown>;
    };
    expect(err.name).toBe("PptrKitError");
    expect(err.retryable).toBe(true);
    expect((err.cause as Error).message).toBe("consumer boom");
    expect(err.context).toEqual({ type: "confirm", action: "accept" });
    expect(log).toHaveBeenCalledWith(err.message, "error");
    // The dialog itself was answered and recorded before the consumer threw.
    expect(handler.handled).toEqual([
      { type: "confirm", message: "Sure?", defaultValue: "", action: "accept" },
    ]);
  });
});

describe("handleDialogs — disposal & beforeunload", () => {
  it("detaches the listener on dispose and is idempotent", () => {
    const { page, off } = pageMock();
    const handler = handleDialogs(page);

    handler.dispose();
    handler.dispose();

    expect(off).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith("dialog", expect.any(Function));
  });

  it("accepts a beforeunload dialog per policy", async () => {
    const { page, fire } = pageMock();
    const handler = handleDialogs(page, {
      policy: { beforeunload: { action: "accept" } },
    });
    const dialog = dialogMock({ type: "beforeunload", message: "Leave?" });

    fire(dialog);
    await flush();

    expect(dialog.accept).toHaveBeenCalledWith(undefined);
    expect(handler.handled).toEqual([
      {
        type: "beforeunload",
        message: "Leave?",
        defaultValue: "",
        action: "accept",
      },
    ]);
  });
});
