import { describe, it, expect, vi } from "vitest";
import type { HTTPRequest, HTTPResponse, Page, ResourceType } from "puppeteer-core";
import { captureResponses } from "./responses.js";

function fakeResponse(opts: {
  url?: string;
  status?: number;
  method?: string;
  resourceType?: ResourceType;
} = {}): HTTPResponse {
  const req = {
    method: () => opts.method ?? "GET",
    resourceType: () => (opts.resourceType ?? "document") as ResourceType,
  } as unknown as HTTPRequest;
  return {
    url: () => opts.url ?? "https://example.com/x",
    status: () => opts.status ?? 200,
    request: () => req,
  } as unknown as HTTPResponse;
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
  it("records each response with url/status/method/resourceType/timestamp", async () => {
    const page = pageMock();
    const collector = await captureResponses(page);

    page._emit("response", fakeResponse({ url: "https://a/", status: 200, method: "GET", resourceType: "document" }));
    page._emit("response", fakeResponse({ url: "https://b/", status: 404, method: "POST", resourceType: "xhr" }));

    expect(collector.responses).toHaveLength(2);
    expect(collector.responses[0]).toMatchObject({
      url: "https://a/",
      status: 200,
      method: "GET",
      resourceType: "document",
    });
    expect(collector.responses[1]).toMatchObject({
      url: "https://b/",
      status: 404,
      method: "POST",
      resourceType: "xhr",
    });
    expect(typeof collector.responses[0]!.timestamp).toBe("number");
  });

  it("filters by `include` resource types", async () => {
    const page = pageMock();
    const collector = await captureResponses(page, { include: ["xhr", "fetch"] });

    page._emit("response", fakeResponse({ resourceType: "document" }));
    page._emit("response", fakeResponse({ resourceType: "xhr" }));
    page._emit("response", fakeResponse({ resourceType: "fetch" }));
    page._emit("response", fakeResponse({ resourceType: "image" }));

    expect(collector.responses.map(r => r.resourceType)).toEqual(["xhr", "fetch"]);
  });

  it("stop() detaches the listener and is idempotent", async () => {
    const page = pageMock();
    const collector = await captureResponses(page);

    page._emit("response", fakeResponse({ url: "https://a/" }));
    collector.stop();
    page._emit("response", fakeResponse({ url: "https://b/" })); // ignored — listener detached
    collector.stop(); // idempotent

    expect(collector.responses).toHaveLength(1);
    expect(page.off).toHaveBeenCalledTimes(1);
  });
});
