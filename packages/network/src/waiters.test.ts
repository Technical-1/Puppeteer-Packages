import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, HTTPResponse, Page } from "puppeteer-core";
import { waitForRequest, waitForResponse } from "./waiters.js";

function pageMock(overrides: Partial<Page> = {}): Page {
  return {
    waitForRequest: vi.fn(),
    waitForResponse: vi.fn(),
    ...overrides,
  } as unknown as Page;
}

describe("waitForResponse", () => {
  it("delegates to page.waitForResponse with the predicate and mapped timeout", async () => {
    const res = { url: () => "https://api/x" } as unknown as HTTPResponse;
    const waitForResponseSpy = vi.fn().mockResolvedValue(res);
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);
    const predicate = (r: HTTPResponse): boolean => r.url().includes("/x");

    const out = await waitForResponse(page, predicate, { timeoutMs: 5000 });

    expect(out).toBe(res);
    expect(waitForResponseSpy).toHaveBeenCalledWith(predicate, {
      timeout: 5000, signal: undefined,
    });
  });

  it("defaults the timeout to 30_000ms", async () => {
    const waitForResponseSpy = vi.fn().mockResolvedValue({} as HTTPResponse);
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);

    await waitForResponse(page, () => true);

    expect(waitForResponseSpy).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 30000, signal: undefined,
    });
  });

  it("wraps a timeout rejection in a core TimeoutError (retryable:true)", async () => {
    const waitForResponseSpy = vi.fn().mockRejectedValue(new Error("Timed out after waiting 5000ms"));
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);

    await expect(waitForResponse(page, () => false, { timeoutMs: 5000 })).rejects.toMatchObject({
      name: "TimeoutError",
      retryable: true,
      cause: expect.objectContaining({ message: "Timed out after waiting 5000ms" }),
    });
  });

  it("passes an aborted-signal cancellation through untouched (not a TimeoutError)", async () => {
    // Real puppeteer throws `signal.reason` DIRECTLY on abort (it races
    // timeout(ms) / fromAbortSignal(signal) / close). Provenance is the
    // thrown object identity, not merely `signal.aborted`.
    const controller = new AbortController();
    controller.abort(new Error("caller cancelled"));
    const waitForResponseSpy = vi.fn().mockRejectedValue(controller.signal.reason);
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);

    await expect(
      waitForResponse(page, () => false, { signal: controller.signal }),
    ).rejects.toBe(controller.signal.reason);
  });

  it("RACE: surfaces a genuine timeout as core TimeoutError even when signal.aborted is true but the thrown cause is an unrelated abort (not signal.reason)", async () => {
    // Simulates: puppeteer's timeout(ms) wins the internal race and rejects
    // with its own TimeoutError, but the caller aborts the (possibly
    // shared/request-scoped) signal in the microtask window before our
    // synchronous catch runs. `signal.aborted` reads true, yet the thrown
    // `cause` is puppeteer's genuine timeout error, NOT `signal.reason`.
    // A state-only check (`if (signal?.aborted) throw cause`) would
    // misclassify this and rethrow the raw, non-retryable puppeteer error.
    const controller = new AbortController();
    const genuineTimeout = new Error("Timed out after waiting 5000ms");
    const waitForResponseSpy = vi.fn().mockImplementation(async () => {
      controller.abort(new Error("unrelated abort reason"));
      throw genuineTimeout;
    });
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);

    await expect(
      waitForResponse(page, () => false, { timeoutMs: 5000, signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "TimeoutError",
      retryable: true,
      cause: genuineTimeout,
    });
  });
});

describe("waitForRequest", () => {
  it("delegates and wraps a timeout in a core TimeoutError (retryable:true)", async () => {
    const req = { url: () => "https://api/x" } as unknown as HTTPRequest;
    const okSpy = vi.fn().mockResolvedValue(req);
    const page = pageMock({ waitForRequest: okSpy } as Partial<Page>);
    const predicate = (r: HTTPRequest): boolean => r.url().includes("/x");

    expect(await waitForRequest(page, predicate, { timeoutMs: 1000 })).toBe(req);
    expect(okSpy).toHaveBeenCalledWith(predicate, { timeout: 1000, signal: undefined });

    const failSpy = vi.fn().mockRejectedValue(new Error("Timed out after waiting 1000ms"));
    const page2 = pageMock({ waitForRequest: failSpy } as Partial<Page>);
    await expect(waitForRequest(page2, () => false, { timeoutMs: 1000 })).rejects.toMatchObject({
      name: "TimeoutError", retryable: true,
    });
  });

  it("passes an aborted-signal cancellation through untouched (cause === signal.reason)", async () => {
    const controller = new AbortController();
    controller.abort(new Error("caller cancelled"));
    const waitForRequestSpy = vi.fn().mockRejectedValue(controller.signal.reason);
    const page = pageMock({ waitForRequest: waitForRequestSpy } as Partial<Page>);

    await expect(
      waitForRequest(page, () => false, { signal: controller.signal }),
    ).rejects.toBe(controller.signal.reason);
  });

  it("RACE: surfaces a genuine timeout as core TimeoutError even when signal.aborted is true but the thrown cause is an unrelated abort (not signal.reason)", async () => {
    const controller = new AbortController();
    const genuineTimeout = new Error("Timed out after waiting 5000ms");
    const waitForRequestSpy = vi.fn().mockImplementation(async () => {
      controller.abort(new Error("unrelated abort reason"));
      throw genuineTimeout;
    });
    const page = pageMock({ waitForRequest: waitForRequestSpy } as Partial<Page>);

    await expect(
      waitForRequest(page, () => false, { timeoutMs: 5000, signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "TimeoutError",
      retryable: true,
      cause: genuineTimeout,
    });
  });
});
