import { describe, it, expect, vi } from "vitest";
import type { BrowserContext, Page } from "puppeteer-core";
import { Session } from "./store.js";

function pageMock(): Page {
  const ctx = {
    cookies: vi.fn().mockResolvedValue([]),
    setCookie: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;
  return {
    browserContext: () => ctx,
    evaluate: vi.fn().mockResolvedValue({ local: { k: "v" }, session: {} }),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("Session store", () => {
  it("save() captures and stores under the label, returning the snapshot", async () => {
    const store = new Session();
    const snap = await store.save(pageMock(), "alice");

    expect(snap.localStorage).toEqual({ k: "v" });
    expect(store.get("alice")).toBe(snap);
  });

  it("load() restores from the stored snapshot to the given page", async () => {
    const store = new Session();
    await store.save(pageMock(), "alice");

    const otherPage = pageMock();
    await store.load(otherPage, "alice");

    expect(otherPage.evaluateOnNewDocument).toHaveBeenCalledOnce();
  });

  it("load() throws SessionError (retryable:false) when label is unknown", async () => {
    const store = new Session();

    await expect(store.load(pageMock(), "ghost")).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
    });
  });

  it("set/get/delete/list manage the in-memory store deterministically", () => {
    const store = new Session();
    const snap = {
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      origin: "https://example.com",
      capturedAt: new Date().toISOString(),
    };

    store.set("a", snap);
    store.set("b", snap);

    expect(store.list().sort()).toEqual(["a", "b"]);
    expect(store.delete("a")).toBe(true);
    expect(store.delete("a")).toBe(false);
    expect(store.list()).toEqual(["b"]);
  });
});
