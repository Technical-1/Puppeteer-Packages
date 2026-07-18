import { describe, it, expect, vi } from "vitest";
import { goto, waitForNetworkIdle, navigateOnGesture } from "./navigation.js";
import type { Page, HTTPResponse } from "puppeteer-core";

function fakeResponse(status = 200): HTTPResponse {
  return { status: () => status } as unknown as HTTPResponse;
}

function mockPage(overrides: Record<string, unknown> = {}): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Page;
}

describe("goto", () => {
  it("calls page.goto with url + waitUntil + timeout", async () => {
    const page = mockPage();
    await goto(page, "https://x.test", { waitUntil: "domcontentloaded", timeout: 9000 });
    expect(page.goto).toHaveBeenCalledWith(
      "https://x.test",
      expect.objectContaining({ waitUntil: "domcontentloaded", timeout: 9000 }),
    );
  });

  it("retries a failing navigation then succeeds (no real wait)", async () => {
    const gotoMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("net::ERR_TIMED_OUT"))
      .mockResolvedValue(null);
    const page = mockPage({ goto: gotoMock });
    await goto(page, "https://x.test", {
      retry: { retries: 2, minDelayMs: 0, jitter: false },
    });
    expect(gotoMock).toHaveBeenCalledTimes(2);
  });

  it("wraps a terminal navigation failure in NavigationError (url + cause)", async () => {
    const cause = new Error("net::ERR_NAME_NOT_RESOLVED");
    const page = mockPage({ goto: vi.fn().mockRejectedValue(cause) });
    const err = await goto(page, "https://bad.test", {
      retry: { retries: 1, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: "NavigationError", url: "https://bad.test" });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });

  it("applies default waitUntil 'load' and timeout 30000 when omitted", async () => {
    const page = mockPage();
    await goto(page, "https://x.test");
    expect(page.goto).toHaveBeenCalledWith(
      "https://x.test",
      expect.objectContaining({ waitUntil: "load", timeout: 30000 }),
    );
  });

  it("logs 'navigating to' at step and 'loaded' at success via the injected logger", async () => {
    const log = vi.fn();
    const page = mockPage();
    await goto(page, "https://x.test", { logger: { log } });
    expect(log).toHaveBeenCalledWith("navigating to https://x.test", "step");
    expect(log).toHaveBeenCalledWith("loaded https://x.test", "success");
  });

  it("lets the caller override isRetryable via opts.retry (terminal immediately)", async () => {
    const gotoMock = vi.fn().mockRejectedValue(new Error("net::ERR_FAILED"));
    const page = mockPage({ goto: gotoMock });
    await expect(
      goto(page, "https://x.test", {
        retry: { retries: 5, minDelayMs: 0, jitter: false, isRetryable: () => false },
      }),
    ).rejects.toMatchObject({ name: "NavigationError" });
    expect(gotoMock).toHaveBeenCalledTimes(1); // not retried — caller override won
  });

  it("passes through the HTTPResponse object returned by page.goto", async () => {
    const response = fakeResponse(200);
    const page = mockPage({ goto: vi.fn().mockResolvedValue(response) });
    const result = await goto(page, "https://x.test");
    expect(result).toBe(response);
  });

  it("returns null when page.goto resolves null", async () => {
    const page = mockPage({ goto: vi.fn().mockResolvedValue(null) });
    const result = await goto(page, "https://x.test");
    expect(result).toBeNull();
  });

  it("rethrows an aborted retry as-is (terminal), not a retryable NavigationError", async () => {
    const ac = new AbortController();
    ac.abort(); // already aborted → withRetry throws before the first attempt
    const gotoMock = vi.fn().mockRejectedValue(new Error("net::ERR_FAILED"));
    const page = mockPage({ goto: gotoMock });

    const err = await goto(page, "https://x.test", {
      retry: { signal: ac.signal, retries: 3, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);

    // The intentional cancellation must pass through untouched, NOT become a
    // retryable NavigationError that an outer retry policy would re-attempt.
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe("Error");
    expect((err as Error).message).toMatch(/abort/i);
    expect(err).not.toMatchObject({ name: "NavigationError" });
    expect((err as { retryable?: unknown }).retryable).toBeUndefined();
    expect(gotoMock).not.toHaveBeenCalled(); // aborted before any attempt
  });

  it("still wraps a genuine retry-exhausted failure as NavigationError even when signal.aborted is true (race: abort unrelated to the failure)", async () => {
    // Race: the caller's signal happens to be aborted (e.g. for an unrelated
    // reason) at the exact moment withRetry exhausts retries on a genuine
    // navigation failure. withRetry's retry-exhaustion path does `throw err`
    // (the real fn() failure) WITHOUT consulting the signal — so the thrown
    // error here is "net::ERR_FAILED", never an "Aborted…" message. A
    // state-based check (`signal.aborted` alone) would misclassify this as a
    // terminal abort passthrough; the fix must key off the error's own
    // provenance (its message) and only pass through true abort errors.
    const ac = new AbortController();
    const gotoMock = vi.fn().mockImplementation(() => {
      // Simulate the abort landing concurrently with the genuine failure,
      // after withRetry has already committed to rethrowing `err` as-is.
      ac.abort();
      return Promise.reject(new Error("net::ERR_FAILED"));
    });
    const page = mockPage({ goto: gotoMock });

    const err = await goto(page, "https://x.test", {
      retry: { signal: ac.signal, retries: 0, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);

    expect(ac.signal.aborted).toBe(true); // confirms the race condition held
    expect(err).toMatchObject({ name: "NavigationError", retryable: true, url: "https://x.test" });
    expect((err as { cause?: unknown }).cause).toBeInstanceOf(Error);
    expect((err as { cause?: Error }).cause?.message).toBe("net::ERR_FAILED");
  });
});

describe("navigateOnGesture", () => {
  function gesturePage(overrides: Record<string, unknown> = {}): Page {
    return {
      url: () => "https://from.test",
      waitForNavigation: vi.fn().mockResolvedValue(fakeResponse(200)),
      ...overrides,
    } as unknown as Page;
  }

  it("races waitForNavigation against the gesture and returns the response", async () => {
    const wfn = vi.fn().mockResolvedValue(fakeResponse(200));
    const gesture = vi.fn().mockResolvedValue(undefined);
    const page = gesturePage({ waitForNavigation: wfn });

    const res = await navigateOnGesture(page, gesture, {
      waitUntil: "domcontentloaded",
      timeout: 9000,
    });

    expect(wfn).toHaveBeenCalledWith(
      expect.objectContaining({ waitUntil: "domcontentloaded", timeout: 9000 }),
    );
    expect(gesture).toHaveBeenCalledTimes(1);
    expect(res).toBe((await wfn.mock.results[0]!.value) as HTTPResponse);
  });

  it("applies default waitUntil 'load' and timeout 30000 when omitted", async () => {
    const wfn = vi.fn().mockResolvedValue(null);
    const page = gesturePage({ waitForNavigation: wfn });
    await navigateOnGesture(page, () => {});
    expect(wfn).toHaveBeenCalledWith(
      expect.objectContaining({ waitUntil: "load", timeout: 30000 }),
    );
  });

  it("returns null for a same-document / no-response navigation", async () => {
    const page = gesturePage({ waitForNavigation: vi.fn().mockResolvedValue(null) });
    const res = await navigateOnGesture(page, () => {});
    expect(res).toBeNull();
  });

  it("retries a failing gesture navigation then succeeds (no real wait)", async () => {
    const wfn = vi
      .fn()
      .mockRejectedValueOnce(new Error("net::ERR_TIMED_OUT"))
      .mockResolvedValue(fakeResponse(200));
    const page = gesturePage({ waitForNavigation: wfn });
    await navigateOnGesture(page, () => {}, {
      retry: { retries: 2, minDelayMs: 0, jitter: false },
    });
    expect(wfn).toHaveBeenCalledTimes(2);
  });

  it("wraps a terminal failure in NavigationError (originating url + cause)", async () => {
    const cause = new Error("net::ERR_ABORTED");
    const page = gesturePage({ waitForNavigation: vi.fn().mockRejectedValue(cause) });
    const err = await navigateOnGesture(page, () => {}, {
      retry: { retries: 1, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ name: "NavigationError", url: "https://from.test", retryable: true });
    expect((err as { cause?: unknown }).cause).toBe(cause);
  });

  it("rethrows an aborted gesture navigation as-is (terminal), not a retryable NavigationError", async () => {
    const ac = new AbortController();
    ac.abort();
    const wfn = vi.fn().mockRejectedValue(new Error("net::ERR_FAILED"));
    const page = gesturePage({ waitForNavigation: wfn });
    const err = await navigateOnGesture(page, () => {}, {
      retry: { signal: ac.signal, retries: 3, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);
    expect((err as Error).name).toBe("Error");
    expect(err).not.toMatchObject({ name: "NavigationError" });
    expect(wfn).not.toHaveBeenCalled();
  });

  it("logs 'awaiting gesture navigation' at step and settled at success", async () => {
    const log = vi.fn();
    const page = gesturePage();
    await navigateOnGesture(page, () => {}, { logger: { log } });
    expect(log).toHaveBeenCalledWith(
      "awaiting gesture navigation from https://from.test",
      "step",
    );
    expect(log).toHaveBeenCalledWith(
      "gesture navigation settled from https://from.test",
      "success",
    );
  });

  it("lets the caller override isRetryable via opts.retry (terminal immediately)", async () => {
    const wfn = vi.fn().mockRejectedValue(new Error("net::ERR_FAILED"));
    const page = gesturePage({ waitForNavigation: wfn });
    await expect(
      navigateOnGesture(page, () => {}, {
        retry: { retries: 5, minDelayMs: 0, jitter: false, isRetryable: () => false },
      }),
    ).rejects.toMatchObject({ name: "NavigationError" });
    expect(wfn).toHaveBeenCalledTimes(1); // caller override won — not retried
  });

  it("still wraps a genuine retry-exhausted failure as NavigationError even when signal.aborted is true (race: abort unrelated to the failure)", async () => {
    const ac = new AbortController();
    const wfn = vi.fn().mockImplementation(() => {
      ac.abort();
      return Promise.reject(new Error("net::ERR_FAILED"));
    });
    const page = gesturePage({ waitForNavigation: wfn });

    const err = await navigateOnGesture(page, () => {}, {
      retry: { signal: ac.signal, retries: 0, minDelayMs: 0, jitter: false },
    }).catch((e: unknown) => e);

    expect(ac.signal.aborted).toBe(true);
    expect(err).toMatchObject({ name: "NavigationError", retryable: true, url: "https://from.test" });
    expect((err as { cause?: unknown }).cause).toBeInstanceOf(Error);
    expect((err as { cause?: Error }).cause?.message).toBe("net::ERR_FAILED");
  });
});

describe("waitForNetworkIdle", () => {
  it("delegates to page.waitForNetworkIdle with options", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page, { idleTime: 600, timeout: 12000 });
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 600, timeout: 12000 }),
    );
  });

  it("applies default idleTime 500 and timeout 30000 when no opts are given (??-branches)", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page);
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 500, timeout: 30000 }),
    );
  });

  it("applies default idleTime 500 when only timeout is provided", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page, { timeout: 5000 });
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 500, timeout: 5000 }),
    );
  });

  it("applies default timeout 30000 when only idleTime is provided", async () => {
    const page = mockPage();
    await waitForNetworkIdle(page, { idleTime: 200 });
    expect(page.waitForNetworkIdle).toHaveBeenCalledWith(
      expect.objectContaining({ idleTime: 200, timeout: 30000 }),
    );
  });

  it("logs a step line on entry via the injected logger", async () => {
    const log = vi.fn();
    const page = mockPage();
    await waitForNetworkIdle(page, { logger: { log }, idleTime: 400 });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("waiting for network idle"),
      "step",
    );
  });

  it("wraps a network-idle timeout in a core TimeoutError (retryable:true) and logs at error", async () => {
    const log = vi.fn();
    const cause = new Error("Waiting failed: 30000ms exceeded"); // puppeteer-shaped reject
    const page = mockPage({
      waitForNetworkIdle: vi.fn().mockRejectedValue(cause),
    });

    const err = await waitForNetworkIdle(page, { timeout: 30000, logger: { log } })
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ name: "TimeoutError", retryable: true });
    expect((err as { cause?: unknown }).cause).toBe(cause);
    expect((err as { context?: Record<string, unknown> }).context).toMatchObject({
      idleTime: 500,
      timeout: 30000,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("network idle wait failed"),
      "error",
    );
  });

  it("stringifies a non-Error rejection when logging the failure", async () => {
    const log = vi.fn();
    const page = mockPage({
      waitForNetworkIdle: vi.fn().mockRejectedValue("boom"),
    });

    const err = await waitForNetworkIdle(page, { logger: { log } })
      .catch((e: unknown) => e);

    expect(err).toMatchObject({ name: "TimeoutError", retryable: true });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("network idle wait failed: boom"),
      "error",
    );
  });
});
