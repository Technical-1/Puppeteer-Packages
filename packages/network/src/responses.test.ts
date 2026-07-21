import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, HTTPResponse, Page, ResourceType } from "puppeteer-core";
import { NetworkError } from "@technical-1/core";
import { captureResponses } from "./responses.js";

function fakeResponse(opts: {
  url?: string;
  status?: number;
  method?: string;
  resourceType?: ResourceType;
  headers?: Record<string, string>;
  fromCache?: boolean;
  buffer?: () => Promise<Buffer>;
  redirectChain?: HTTPRequest[];
} = {}): HTTPResponse {
  const req = {
    method: () => opts.method ?? "GET",
    resourceType: () => (opts.resourceType ?? "document") as ResourceType,
    redirectChain: () => opts.redirectChain ?? [],
  } as unknown as HTTPRequest;
  return {
    url: () => opts.url ?? "https://example.com/x",
    status: () => opts.status ?? 200,
    headers: () => opts.headers ?? { "content-type": "text/html" },
    fromCache: () => opts.fromCache ?? false,
    buffer: opts.buffer ?? (async () => Buffer.from("")),
    request: () => req,
  } as unknown as HTTPResponse;
}

// helper: a prior redirect request with its own response()/status()
function redirectReq(url: string, status: number, method = "GET"): HTTPRequest {
  return {
    url: () => url,
    method: () => method,
    response: () => ({ status: () => status } as unknown as HTTPResponse),
  } as unknown as HTTPRequest;
}

function pageMock() {
  const listeners = new Map<string, (res: HTTPResponse) => void>();
  const page = {
    on: vi.fn((event: string, fn: (res: HTTPResponse) => void) => {
      listeners.set(event, fn);
      return page;
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
      return page;
    }),
  } as unknown as Page & { _emit: (event: string, res: HTTPResponse) => void };
  (page as { _emit: (event: string, res: HTTPResponse) => void })._emit = (event, res) => {
    listeners.get(event)?.(res);
  };
  return page;
}

describe("captureResponses", () => {
  it("records url/status/method/resourceType/timestamp plus headers and fromCache", () => {
    const page = pageMock();
    const collector = captureResponses(page);

    page._emit("response", fakeResponse({
      url: "https://a/", status: 200, method: "GET", resourceType: "document",
      headers: { "content-type": "text/html", "x-cache": "MISS" }, fromCache: false,
    }));
    page._emit("response", fakeResponse({
      url: "https://b/", status: 404, method: "POST", resourceType: "xhr",
      headers: { "content-type": "application/json" }, fromCache: true,
    }));

    expect(collector.responses).toHaveLength(2);
    expect(collector.responses[0]).toMatchObject({
      url: "https://a/", status: 200, method: "GET", resourceType: "document",
      headers: { "content-type": "text/html", "x-cache": "MISS" }, fromCache: false,
    });
    expect(collector.responses[1]).toMatchObject({
      url: "https://b/", status: 404, method: "POST", resourceType: "xhr", fromCache: true,
    });
    expect(typeof collector.responses[0]!.timestamp).toBe("number");
  });

  it("filters by `include` resource types", () => {
    const page = pageMock();
    const collector = captureResponses(page, { include: ["xhr", "fetch"] });

    page._emit("response", fakeResponse({ resourceType: "document" }));
    page._emit("response", fakeResponse({ resourceType: "xhr" }));
    page._emit("response", fakeResponse({ resourceType: "fetch" }));
    page._emit("response", fakeResponse({ resourceType: "image" }));

    expect(collector.responses.map(r => r.resourceType)).toEqual(["xhr", "fetch"]);
  });

  it("stop() detaches the listener and is idempotent", () => {
    const page = pageMock();
    const collector = captureResponses(page);

    page._emit("response", fakeResponse({ url: "https://a/" }));
    collector.stop();
    page._emit("response", fakeResponse({ url: "https://b/" })); // ignored — detached
    collector.stop(); // idempotent

    expect(collector.responses).toHaveLength(1);
    expect(page.off).toHaveBeenCalledTimes(1);
  });

  it("body accessors throw a terminal NetworkError when body capture is disabled", async () => {
    const page = pageMock();
    const collector = captureResponses(page); // body omitted => disabled

    page._emit("response", fakeResponse({ resourceType: "xhr" }));
    const rec = collector.responses[0]!;

    await expect(rec.buffer()).rejects.toBeInstanceOf(NetworkError);
    await expect(rec.buffer()).rejects.toMatchObject({
      name: "NetworkError", retryable: false,
    });
    await expect(rec.text()).rejects.toMatchObject({ retryable: false });
    await expect(rec.json()).rejects.toMatchObject({ retryable: false });
  });

  it("body:true exposes buffer/text/json and caches the body (buffer pulled once)", async () => {
    const page = pageMock();
    const collector = captureResponses(page, { body: true });

    const buf = vi.fn(async () => Buffer.from(JSON.stringify({ ok: 1 })));
    page._emit("response", fakeResponse({ resourceType: "xhr", buffer: buf }));
    const rec = collector.responses[0]!;

    expect(await rec.text()).toBe('{"ok":1}');
    expect(await rec.json()).toEqual({ ok: 1 });
    expect(new TextDecoder().decode(await rec.buffer())).toBe('{"ok":1}');
    expect(buf).toHaveBeenCalledTimes(1); // cached after first pull
  });

  it("body gated by resource-type array: enabled for xhr, disabled for document", async () => {
    const page = pageMock();
    const collector = captureResponses(page, { body: ["xhr"] });

    page._emit("response", fakeResponse({
      resourceType: "xhr", buffer: async () => Buffer.from("hi"),
    }));
    page._emit("response", fakeResponse({ resourceType: "document" }));

    expect(await collector.responses[0]!.text()).toBe("hi");
    await expect(collector.responses[1]!.buffer()).rejects.toMatchObject({ retryable: false });
  });

  it("wraps a body read protocol failure as a retryable NetworkError", async () => {
    const page = pageMock();
    const collector = captureResponses(page, { body: true });

    page._emit("response", fakeResponse({
      resourceType: "xhr",
      buffer: async () => { throw new Error("No resource with given identifier"); },
    }));

    await expect(collector.responses[0]!.buffer()).rejects.toBeInstanceOf(NetworkError);
    await expect(collector.responses[0]!.buffer()).rejects.toMatchObject({
      name: "NetworkError", retryable: true,
      cause: expect.objectContaining({ message: "No resource with given identifier" }),
    });
  });

  it("json() throws a terminal NetworkError on malformed JSON", async () => {
    const page = pageMock();
    const collector = captureResponses(page, { body: true });

    page._emit("response", fakeResponse({
      resourceType: "xhr", buffer: async () => Buffer.from("not json"),
    }));

    await expect(collector.responses[0]!.json()).rejects.toBeInstanceOf(NetworkError);
    await expect(collector.responses[0]!.json()).rejects.toMatchObject({
      name: "NetworkError", retryable: false,
    });
  });

  it("records an empty redirects array for a direct (non-redirected) response", () => {
    const page = pageMock();
    const collector = captureResponses(page);
    page._emit("response", fakeResponse({ url: "https://a/", status: 200 }));
    expect(collector.responses[0]!.redirects).toEqual([]);
  });

  it("reconstructs the 301 -> 302 -> 200 hop chain from redirectChain()", () => {
    const page = pageMock();
    const collector = captureResponses(page);
    page._emit("response", fakeResponse({
      url: "https://final/",
      status: 200,
      redirectChain: [
        redirectReq("https://a/", 301),
        redirectReq("https://b/", 302),
      ],
    }));
    expect(collector.responses[0]!.redirects).toEqual([
      { url: "https://a/", method: "GET", status: 301 },
      { url: "https://b/", method: "GET", status: 302 },
    ]);
    expect(collector.responses[0]!.status).toBe(200); // the final hop is the record itself
  });

  it("uses status null for a redirect hop that has no response yet", () => {
    const page = pageMock();
    const collector = captureResponses(page);
    const noResp = { url: () => "https://p/", method: () => "GET", response: () => null } as unknown as HTTPRequest;
    page._emit("response", fakeResponse({ url: "https://final/", redirectChain: [noResp] }));
    expect(collector.responses[0]!.redirects).toEqual([{ url: "https://p/", method: "GET", status: null }]);
  });
});
