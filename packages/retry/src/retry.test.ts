import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry.js";
import { NavigationError, SelectorNotFoundError } from "@technical-1/core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Run a promise to settlement while draining fake timers. */
async function settle<T>(p: Promise<T>): Promise<T> {
  const result = p;
  await vi.runAllTimersAsync();
  return result;
}

describe("withRetry", () => {
  it("resolves on first success without delay", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(settle(withRetry(fn))).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("retries a retryable error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NavigationError("https://x.test"))
      .mockResolvedValue("ok");
    await expect(settle(withRetry(fn, { retries: 3, minDelayMs: 10 }))).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a terminal (non-retryable) error", async () => {
    const fn = vi.fn().mockRejectedValue(new SelectorNotFoundError("#x"));
    await expect(settle(withRetry(fn, { retries: 5 }))).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws the last error", async () => {
    const err = new NavigationError("https://x.test");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      settle(withRetry(fn, { retries: 2, minDelayMs: 1 })),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("honors a custom isRetryable predicate", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("plain transient"))
      .mockResolvedValue("ok");
    const isRetryable = (e: unknown) => e instanceof Error && e.message.includes("transient");
    await expect(
      settle(withRetry(fn, { retries: 2, minDelayMs: 1, isRetryable })),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rejects immediately when the abort signal is already aborted", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const controller = new AbortController();
    controller.abort();
    await expect(
      settle(withRetry(fn, { signal: controller.signal })),
    ).rejects.toThrow(/abort/i);
    expect(fn).not.toHaveBeenCalled();
  });
});
