import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, Page } from "puppeteer-core";
import { NetworkError } from "@technical-1/core";
import { mockRequests } from "./mocking.js";
import { registerInterceptor } from "./interception.js";

function fakeRequest(url = "https://example.com/x", method = "GET"): HTTPRequest {
  return {
    url: () => url,
    method: () => method,
    abort: vi.fn().mockResolvedValue(undefined),
    respond: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
  } as unknown as HTTPRequest;
}

function pageMock() {
  const listeners = new Map<string, (req: HTTPRequest) => unknown>();
  const page = {
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, fn: (req: HTTPRequest) => unknown) => {
      listeners.set(event, fn);
      return page;
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
      return page;
    }),
  } as unknown as Page & { _emit: (event: string, req: HTTPRequest) => Promise<void> };
  (page as { _emit: (event: string, req: HTTPRequest) => Promise<void> })._emit = async (event, req) => {
    const fn = listeners.get(event);
    if (fn !== undefined) await fn(req);
  };
  return page;
}

describe("mockRequests", () => {
  it("fulfils a matching request with a synthetic response", async () => {
    const page = pageMock();
    await mockRequests(page, [
      { when: /\/api\/user/, action: { kind: "respond", response: { status: 200, contentType: "application/json", body: '{"id":1}' } } },
    ]);
    const req = fakeRequest("https://x/api/user");
    await page._emit("request", req);
    expect(req.respond).toHaveBeenCalledWith({ status: 200, contentType: "application/json", body: '{"id":1}' });
    expect(req.continue).not.toHaveBeenCalled();
  });

  it("continues a matching request with header/method overrides", async () => {
    const page = pageMock();
    await mockRequests(page, [
      { when: (r) => r.method() === "GET", action: { kind: "modify", overrides: { method: "POST", headers: { "x-test": "1" } } } },
    ]);
    const req = fakeRequest("https://x/y", "GET");
    await page._emit("request", req);
    expect(req.continue).toHaveBeenCalledWith({ method: "POST", headers: { "x-test": "1" } });
  });

  it("aborts a matching request with a specific CDP error code", async () => {
    const page = pageMock();
    await mockRequests(page, [
      { when: /tracker/, action: { kind: "abort", errorCode: "blockedbyclient" } },
    ]);
    const req = fakeRequest("https://tracker.example/px");
    await page._emit("request", req);
    expect(req.abort).toHaveBeenCalledWith("blockedbyclient");
  });

  it("leaves non-matching requests untouched (bare continue)", async () => {
    const page = pageMock();
    await mockRequests(page, [{ when: /\/api\//, action: { kind: "abort" } }]);
    const req = fakeRequest("https://x/page.html");
    await page._emit("request", req);
    expect(req.abort).not.toHaveBeenCalled();
    expect(req.continue).toHaveBeenCalledWith();
  });

  it("applies the FIRST matching rule only", async () => {
    const page = pageMock();
    await mockRequests(page, [
      { when: /\/api\//, action: { kind: "respond", response: { status: 200 } } },
      { when: /\/api\//, action: { kind: "abort" } },
    ]);
    const req = fakeRequest("https://x/api/z");
    await page._emit("request", req);
    expect(req.respond).toHaveBeenCalledWith({ status: 200 });
    expect(req.abort).not.toHaveBeenCalled();
  });

  it("coexists with a pre-registered interceptor without enabling interception twice", async () => {
    const page = pageMock();
    // Simulate blockResources having already registered on this page.
    await registerInterceptor(page, () => undefined);
    await mockRequests(page, [{ when: /\/api\//, action: { kind: "respond", response: { status: 204 } } }]);
    // One owner: interception enabled exactly once across both consumers.
    expect(page.setRequestInterception).toHaveBeenCalledTimes(1);

    const req = fakeRequest("https://x/api/z");
    await page._emit("request", req);
    expect(req.respond).toHaveBeenCalledWith({ status: 204 });
  });

  it("throws NetworkError (retryable:false) for an empty rule list", async () => {
    const page = pageMock();
    await expect(mockRequests(page, [])).rejects.toBeInstanceOf(NetworkError);
    await expect(mockRequests(page, [])).rejects.toMatchObject({ name: "NetworkError", retryable: false });
  });

  it("disposer removes the mocks and disables interception when it was the only consumer", async () => {
    const page = pageMock();
    const dispose = await mockRequests(page, [{ when: /\/api\//, action: { kind: "abort" } }]);
    await dispose();
    expect(page.setRequestInterception).toHaveBeenLastCalledWith(false);
    expect(page.off).toHaveBeenCalledWith("request", expect.any(Function));

    // After disposal a matching request is no longer mocked.
    const dispose2 = await mockRequests(page, [{ when: /\/api\//, action: { kind: "abort" } }]);
    expect(page.setRequestInterception).toHaveBeenLastCalledWith(true);
    await dispose2();
  });

  it("logs matched actions via the injected logger when provided", async () => {
    const page = pageMock();
    const log = vi.fn();
    await mockRequests(page, [{ when: /\/api\//, action: { kind: "respond", response: { status: 200 } } }], { logger: { log } });
    await page._emit("request", fakeRequest("https://x/api/z"));
    expect(log).toHaveBeenCalled();
  });
});
