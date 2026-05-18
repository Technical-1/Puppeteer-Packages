import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry.js";
import { NavigationError, SelectorNotFoundError } from "@technical-1/core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withRetry", () => {
  it("resolves on first success without delay", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("retries a retryable error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NavigationError("https://x.test"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, { retries: 3, minDelayMs: 10 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a terminal (non-retryable) error", async () => {
    const fn = vi.fn().mockRejectedValue(new SelectorNotFoundError("#x"));
    const p = withRetry(fn, { retries: 5 });
    const assertion = expect(p).rejects.toBeInstanceOf(SelectorNotFoundError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws the last error", async () => {
    const err = new NavigationError("https://x.test");
    const fn = vi.fn().mockRejectedValue(err);
    const p = withRetry(fn, { retries: 2, minDelayMs: 1 });
    const assertion = expect(p).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("honors a custom isRetryable predicate", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("plain transient"))
      .mockResolvedValue("ok");
    const isRetryable = (e: unknown) =>
      e instanceof Error && e.message.includes("transient");
    const p = withRetry(fn, { retries: 2, minDelayMs: 1, isRetryable });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rejects immediately when the abort signal is already aborted", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const controller = new AbortController();
    controller.abort();
    await expect(
      withRetry(fn, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
    expect(fn).not.toHaveBeenCalled();
  });
});
