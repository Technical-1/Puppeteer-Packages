import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, Page } from "puppeteer-core";
import { registerInterceptor, teardownIfEmpty } from "./interception.js";

function fakeRequest(url = "https://example.com/x"): HTTPRequest {
  return {
    url: () => url,
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

describe("interception coordinator", () => {
  it("enables setRequestInterception(true) exactly once across multiple consumers", async () => {
    const page = pageMock();
    await registerInterceptor(page, () => undefined);
    await registerInterceptor(page, () => undefined);
    expect(page.setRequestInterception).toHaveBeenCalledTimes(1);
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
  });

  it("bare-continues a request when no interceptor has an opinion", async () => {
    const page = pageMock();
    await registerInterceptor(page, () => undefined);
    const req = fakeRequest();
    await page._emit("request", req);
    expect(req.continue).toHaveBeenCalledWith();
    expect(req.abort).not.toHaveBeenCalled();
    expect(req.respond).not.toHaveBeenCalled();
  });

  it("first interceptor with a decision wins (ordered)", async () => {
    const page = pageMock();
    await registerInterceptor(page, () => ({ action: "abort", errorCode: "failed" }));
    await registerInterceptor(page, () => ({ action: "respond", response: { status: 200 } }));
    const req = fakeRequest();
    await page._emit("request", req);
    expect(req.abort).toHaveBeenCalledWith("failed");
    expect(req.respond).not.toHaveBeenCalled();
    expect(req.continue).not.toHaveBeenCalled();
  });

  it("applies respond and continue-with-overrides decisions", async () => {
    const page = pageMock();
    const dispose = await registerInterceptor(page, (r) =>
      r.url().includes("/api")
        ? { action: "respond", response: { status: 201, body: "ok" } }
        : { action: "continue", overrides: { method: "POST" } },
    );
    const api = fakeRequest("https://x/api");
    const other = fakeRequest("https://x/page");
    await page._emit("request", api);
    await page._emit("request", other);
    expect(api.respond).toHaveBeenCalledWith({ status: 201, body: "ok" });
    expect(other.continue).toHaveBeenCalledWith({ method: "POST" });
    dispose();
  });

  it("swallows the already-handled race without throwing out of the listener", async () => {
    const page = pageMock();
    await registerInterceptor(page, () => ({ action: "continue" }));
    const req = fakeRequest();
    (req.continue as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Request is already handled"));
    await expect(page._emit("request", req)).resolves.toBeUndefined();
  });

  it("the disposer is idempotent — a second call removes nothing more", async () => {
    const page = pageMock();
    const dispose = await registerInterceptor(page, () => ({ action: "abort" }));
    const second = await registerInterceptor(page, () => undefined);
    dispose();
    dispose(); // no-op; must not remove the still-registered second interceptor

    const req = fakeRequest();
    await page._emit("request", req);
    expect(req.abort).not.toHaveBeenCalled(); // first interceptor is gone
    expect(req.continue).toHaveBeenCalledWith(); // second falls through to bare continue
    second();
  });

  it("teardownIfEmpty is a no-op when no consumer ever registered", async () => {
    const page = pageMock();
    await expect(teardownIfEmpty(page)).resolves.toBeUndefined();
    expect(page.setRequestInterception).not.toHaveBeenCalled();
    expect(page.off).not.toHaveBeenCalled();
  });

  it("teardownIfEmpty disables interception only after the last interceptor is removed", async () => {
    const page = pageMock();
    const disposeA = await registerInterceptor(page, () => undefined);
    const disposeB = await registerInterceptor(page, () => undefined);

    disposeA();
    await teardownIfEmpty(page);
    expect(page.setRequestInterception).toHaveBeenCalledTimes(1); // still 1 consumer left, no false

    disposeB();
    await teardownIfEmpty(page);
    expect(page.setRequestInterception).toHaveBeenLastCalledWith(false);
    expect(page.off).toHaveBeenCalledWith("request", expect.any(Function));

    // A fresh registration re-enables interception (proves clean teardown).
    await registerInterceptor(page, () => undefined);
    expect(page.setRequestInterception).toHaveBeenCalledTimes(3); // true, false, true
  });
});
