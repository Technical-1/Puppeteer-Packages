import { describe, it, expect, vi } from "vitest";
import { goto, waitForNetworkIdle } from "./navigation.js";
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
});
