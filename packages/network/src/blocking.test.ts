import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, Page, ResourceType } from "puppeteer-core";
import { NetworkError } from "@technical-1/core";
import { blockResources, unblockResources } from "./blocking.js";

interface FakeRequestArgs {
  url?: string;
  resourceType?: ResourceType;
}

function fakeRequest({ url = "https://example.com/x", resourceType = "document" as ResourceType }: FakeRequestArgs = {}): HTTPRequest {
  return {
    url: () => url,
    resourceType: () => resourceType,
    abort: vi.fn().mockResolvedValue(undefined),
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

describe("blockResources", () => {
  it("aborts requests matching a ResourceType string", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);

    const imgReq = fakeRequest({ resourceType: "image" });
    const docReq = fakeRequest({ resourceType: "document" });
    await page._emit("request", imgReq);
    await page._emit("request", docReq);

    expect(imgReq.abort).toHaveBeenCalledOnce();
    expect(docReq.abort).not.toHaveBeenCalled();
    expect(docReq.continue).toHaveBeenCalledOnce();
  });

  it("aborts requests matching a RegExp URL pattern", async () => {
    const page = pageMock();
    await blockResources(page, [/analytics/]);

    const blocked = fakeRequest({ url: "https://google-analytics.com/x" });
    const allowed = fakeRequest({ url: "https://example.com/" });
    await page._emit("request", blocked);
    await page._emit("request", allowed);

    expect(blocked.abort).toHaveBeenCalledOnce();
    expect(allowed.continue).toHaveBeenCalledOnce();
  });

  it("enables setRequestInterception(true) exactly once even on repeat calls", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await blockResources(page, ["image", "stylesheet"]);

    expect(page.setRequestInterception).toHaveBeenCalledTimes(1);
  });

  it("merges patterns across repeat calls", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await blockResources(page, [/analytics/]);

    const img = fakeRequest({ resourceType: "image" });
    const analytics = fakeRequest({ url: "https://analytics.example.com/x" });
    await page._emit("request", img);
    await page._emit("request", analytics);

    expect(img.abort).toHaveBeenCalledOnce();
    expect(analytics.abort).toHaveBeenCalledOnce();
  });

  it("throws NetworkError (retryable:false) for an empty pattern list", async () => {
    const page = pageMock();
    await expect(blockResources(page, [])).rejects.toBeInstanceOf(NetworkError);
    await expect(blockResources(page, [])).rejects.toMatchObject({
      name: "NetworkError",
      retryable: false,
    });
  });
});

describe("unblockResources", () => {
  it("disables interception and detaches the listener", async () => {
    const page = pageMock();
    await blockResources(page, ["image"]);
    await unblockResources(page);

    expect(page.setRequestInterception).toHaveBeenLastCalledWith(false);
    expect(page.off).toHaveBeenCalled();

    // After unblock, a fresh blockResources call must re-enable interception.
    await blockResources(page, ["image"]);
    expect(page.setRequestInterception).toHaveBeenCalledTimes(3); // true, false, true
  });

  it("is idempotent when interception was never enabled", async () => {
    const page = pageMock();
    await expect(unblockResources(page)).resolves.toBeUndefined();
  });
});
