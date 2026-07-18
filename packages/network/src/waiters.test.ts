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
    const waitForResponseSpy = vi.fn().mockRejectedValue(new Error("Waiting failed: 5000ms exceeded"));
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);

    await expect(waitForResponse(page, () => false, { timeoutMs: 5000 })).rejects.toMatchObject({
      name: "TimeoutError",
      retryable: true,
      cause: expect.objectContaining({ message: "Waiting failed: 5000ms exceeded" }),
    });
  });

  it("passes an aborted-signal cancellation through untouched (not a TimeoutError)", async () => {
    const abortErr = new Error("Wait cancelled");
    const waitForResponseSpy = vi.fn().mockRejectedValue(abortErr);
    const page = pageMock({ waitForResponse: waitForResponseSpy } as Partial<Page>);
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForResponse(page, () => false, { signal: controller.signal }),
    ).rejects.toBe(abortErr);
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

    const failSpy = vi.fn().mockRejectedValue(new Error("Waiting failed"));
    const page2 = pageMock({ waitForRequest: failSpy } as Partial<Page>);
    await expect(waitForRequest(page2, () => false, { timeoutMs: 1000 })).rejects.toMatchObject({
      name: "TimeoutError", retryable: true,
    });
  });
});
