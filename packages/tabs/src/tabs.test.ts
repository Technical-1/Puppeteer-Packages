import { describe, it, expect, vi, afterEach } from "vitest";
import type { Browser, Page, Target } from "puppeteer-core";
import { waitForNewPage } from "./tabs.js";

/** A Browser fake with a real listener registry so we can emit targets. */
function mockBrowser(): Browser & { emit: (event: string, target: Target) => void } {
  const listeners: Record<string, Array<(t: Target) => void>> = {};
  const browser = {
    on: vi.fn((event: string, fn: (t: Target) => void) => {
      (listeners[event] ??= []).push(fn);
      return browser;
    }),
    off: vi.fn((event: string, fn: (t: Target) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
      return browser;
    }),
    emit: (event: string, target: Target) => {
      for (const fn of [...(listeners[event] ?? [])]) fn(target);
    },
  };
  return browser as unknown as Browser & { emit: (event: string, target: Target) => void };
}

function mockPage(): Page {
  return { url: () => "https://popup.test/" } as unknown as Page;
}

function mockTarget(overrides: Partial<Record<"type" | "url" | "page", unknown>> = {}): Target {
  return {
    type: () => "page",
    url: () => "https://popup.test/",
    page: vi.fn().mockResolvedValue(mockPage()),
    ...overrides,
  } as unknown as Target;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForNewPage", () => {
  it("subscribes to 'targetcreated' before running the trigger and resolves the new Page", async () => {
    const browser = mockBrowser();
    const page = mockPage();
    const target = mockTarget({ page: vi.fn().mockResolvedValue(page) });
    // Trigger emits the target synchronously — only works if we subscribed first.
    const result = await waitForNewPage(browser, () => {
      browser.emit("targetcreated", target);
    });
    expect(browser.on).toHaveBeenCalledWith("targetcreated", expect.any(Function));
    expect(result).toBe(page);
  });

  it("ignores non-page targets and resolves on the first page target", async () => {
    const browser = mockBrowser();
    const page = mockPage();
    const worker = mockTarget({ type: () => "service_worker" });
    const pageTarget = mockTarget({ page: vi.fn().mockResolvedValue(page) });
    const result = await waitForNewPage(browser, () => {
      browser.emit("targetcreated", worker);
      browser.emit("targetcreated", pageTarget);
    });
    expect(result).toBe(page);
    expect(worker.page).not.toHaveBeenCalled();
  });

  it("keeps waiting when target.page() resolves null, then settles on the next page", async () => {
    const browser = mockBrowser();
    const page = mockPage();
    const empty = mockTarget({ page: vi.fn().mockResolvedValue(null) });
    const real = mockTarget({ page: vi.fn().mockResolvedValue(page) });
    const p = waitForNewPage(browser, () => {});
    browser.emit("targetcreated", empty);
    browser.emit("targetcreated", real);
    expect(await p).toBe(page);
  });

  it("skips a target whose type() throws and settles on the next page", async () => {
    const browser = mockBrowser();
    const page = mockPage();
    const throwing = mockTarget({
      type: () => {
        throw new Error("target detached");
      },
    });
    const real = mockTarget({ page: vi.fn().mockResolvedValue(page) });
    const p = waitForNewPage(browser, () => {});
    browser.emit("targetcreated", throwing);
    browser.emit("targetcreated", real);
    expect(await p).toBe(page);
    expect(throwing.page).not.toHaveBeenCalled();
  });

  it("detaches the 'targetcreated' listener and clears the timer on success", async () => {
    const browser = mockBrowser();
    const target = mockTarget();
    await waitForNewPage(browser, () => {
      browser.emit("targetcreated", target);
    });
    expect(browser.off).toHaveBeenCalledWith("targetcreated", expect.any(Function));
  });

  it("throws a retryable TimeoutError when no new page appears within the timeout", async () => {
    vi.useFakeTimers();
    const browser = mockBrowser();
    const p = waitForNewPage(browser, () => {}, { timeout: 1000 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await p;
    expect(err).toMatchObject({ name: "TimeoutError", retryable: true });
    expect((err as { context: { timeout: number } }).context.timeout).toBe(1000);
    expect(browser.off).toHaveBeenCalledWith("targetcreated", expect.any(Function));
  });

  it("applies the default 30000ms timeout when none is given", async () => {
    vi.useFakeTimers();
    const browser = mockBrowser();
    const p = waitForNewPage(browser, () => {}).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(29_999);
    // not yet rejected
    await vi.advanceTimersByTimeAsync(1);
    const err = await p;
    expect(err).toMatchObject({ name: "TimeoutError" });
    expect((err as { context: { timeout: number } }).context.timeout).toBe(30_000);
  });

  it("wraps a throwing trigger in a terminal PptrKitError and cleans up", async () => {
    const browser = mockBrowser();
    const cause = new Error("click failed");
    const err = await waitForNewPage(browser, () => {
      throw cause;
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: "PptrKitError", retryable: false });
    expect((err as { cause?: unknown }).cause).toBe(cause);
    expect(browser.off).toHaveBeenCalledWith("targetcreated", expect.any(Function));
  });

  it("wraps a rejecting target.page() in a terminal PptrKitError", async () => {
    const browser = mockBrowser();
    const cause = new Error("CDP detached");
    const target = mockTarget({ page: vi.fn().mockRejectedValue(cause) });
    const p = waitForNewPage(browser, () => {}).catch((e: unknown) => e);
    browser.emit("targetcreated", target);
    const err = await p;
    expect(err).toMatchObject({ name: "PptrKitError", retryable: false });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });

  it("logs a step line on entry and a success line on settle via the injected logger", async () => {
    const log = vi.fn();
    const browser = mockBrowser();
    const target = mockTarget();
    await waitForNewPage(
      browser,
      () => {
        browser.emit("targetcreated", target);
      },
      { logger: { log } },
    );
    expect(log).toHaveBeenCalledWith("waiting for new page/tab", "step");
    expect(log).toHaveBeenCalledWith("new page/tab settled", "success");
  });
});
