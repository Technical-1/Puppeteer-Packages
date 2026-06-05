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

  it("aborts an in-flight retry wait via the abort listener (mid-sleep)", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new NavigationError("https://x.test"));
    const p = withRetry(fn, {
      retries: 5,
      minDelayMs: 1000,
      jitter: false,
      signal: controller.signal,
    });
    const assertion = expect(p).rejects.toThrow(/abort/i);
    // Run attempt 1 (rejects) and enter sleep(1000); 10ms < 1000ms so the
    // timer is pending, not elapsed — withRetry is parked in sleep().
    await vi.advanceTimersByTimeAsync(10);
    controller.abort(); // fires onAbort -> clearTimeout + reject("Aborted")
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1); // no further attempts after abort
  });

  it("logs a warn line between attempts via the injected logger", async () => {
    const log = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NavigationError("https://x.test"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, { retries: 2, minDelayMs: 1, logger: { log } });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("retry 1/2"),
      "warn",
    );
  });

  it("delays grow exponentially (not constant) when jitter is off", async () => {
    const fn = vi.fn().mockRejectedValue(new NavigationError("https://x.test"));
    const p = withRetry(fn, {
      retries: 3,
      minDelayMs: 100,
      factor: 2,
      jitter: false,
    });
    const assertion = expect(p).rejects.toBeInstanceOf(NavigationError);
    // attempt 1 failed -> first wait is 100ms (100 * 2^0)
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    // attempt 2 failed -> next wait is 200ms (100 * 2^1), longer than the first
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("rejects in sleep() when the signal is aborted between fn rejection and sleep entry", async () => {
    const controller = new AbortController();
    // fn aborts the signal on its first call, then throws a retryable error —
    // by the time withRetry calls sleep(), signal.aborted is already true, so
    // the synchronous guard at the top of sleep() fires immediately.
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new NavigationError("https://x.test");
    });
    const p = withRetry(fn, {
      retries: 3,
      minDelayMs: 1000,
      jitter: false,
      signal: controller.signal,
    });
    const assertion = expect(p).rejects.toThrow(/abort/i);
    await vi.runAllTimersAsync();
    await assertion;
    // fn ran exactly once; the aborted signal prevented any retry sleep
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("treats an error with a throwing retryable getter as non-retryable (defaultIsRetryable catch)", async () => {
    // Construct an object whose `retryable` property getter throws; the catch
    // inside defaultIsRetryable must swallow it and return false.
    const poisonedErr = Object.defineProperty(new Error("oops"), "retryable", {
      get() { throw new Error("getter explodes"); },
    });
    const fn = vi.fn().mockRejectedValue(poisonedErr);
    const p = withRetry(fn, { retries: 3 });
    const assertion = expect(p).rejects.toBe(poisonedErr);
    await vi.runAllTimersAsync();
    await assertion;
    // Non-retryable → no retries, fn called exactly once
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clamps delay to maxDelayMs when exponential growth would exceed it", async () => {
    const fn = vi.fn().mockRejectedValue(new NavigationError("https://x.test"));
    const p = withRetry(fn, {
      retries: 3,
      minDelayMs: 100,
      maxDelayMs: 150,
      factor: 10,
      jitter: false,
    });
    const assertion = expect(p).rejects.toBeInstanceOf(NavigationError);
    // attempt 1: raw=100*10^0=100 → capped at min(100,150)=100ms
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    // attempt 2: raw=100*10^1=1000 → capped at maxDelayMs=150ms
    await vi.advanceTimersByTimeAsync(149);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("removes the abort listener when the retry sleep completes normally (signal provided but never fired)", async () => {
    // Provides a signal that is never aborted so the sleep timer fires normally;
    // this exercises the signal?.removeEventListener path inside sleep().
    const controller = new AbortController();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NavigationError("https://x.test"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, {
      retries: 2,
      minDelayMs: 100,
      jitter: false,
      signal: controller.signal,
    });
    // Let the sleep timer elapse naturally (no abort)
    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("logs String(err) in the warn message when the thrown error is not an Error instance", async () => {
    const log = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce("string-error")
      .mockResolvedValue("ok");
    const isRetryable = () => true;
    const p = withRetry(fn, {
      retries: 2,
      minDelayMs: 1,
      logger: { log },
      isRetryable,
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    // String(err) path: the log message uses the string representation directly
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("string-error"),
      "warn",
    );
  });
});
