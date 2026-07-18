import { describe, it, expect, vi } from "vitest";
import { resolveFrame } from "./frames.js";
import { SelectorNotFoundError } from "@technical-1/core";
import type { Page, Frame } from "puppeteer-core";

function frameStub(name: string, url: string): Frame {
  return { name: () => name, url: () => url } as unknown as Frame;
}

function mockFramePage(overrides: Record<string, unknown> = {}): Page {
  return {
    frames: vi.fn().mockReturnValue([]),
    $: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as Page;
}

describe("resolveFrame", () => {
  it("finds a frame by name", async () => {
    const target = frameStub("checkout", "https://pay.example/x");
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("", "about:blank"), target]),
    });
    expect(await resolveFrame(page, { name: "checkout" })).toBe(target);
  });

  it("finds a frame by url substring", async () => {
    const target = frameStub("", "https://pay.example/widget");
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("", "https://other"), target]),
    });
    expect(await resolveFrame(page, { url: "pay.example" })).toBe(target);
  });

  it("finds a frame by url RegExp", async () => {
    const target = frameStub("", "https://pay.example/widget");
    const page = mockFramePage({ frames: vi.fn().mockReturnValue([target]) });
    expect(await resolveFrame(page, { url: /pay\.example/ })).toBe(target);
  });

  it("matches on name AND url together", async () => {
    const target = frameStub("pay", "https://pay.example/w");
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("pay", "https://nope"), target]),
    });
    expect(await resolveFrame(page, { name: "pay", url: "pay.example" })).toBe(
      target,
    );
  });

  it("resolves a frame from an iframe selector via contentFrame", async () => {
    const target = frameStub("inner", "https://inner");
    const handle = { contentFrame: vi.fn().mockResolvedValue(target) };
    const page = mockFramePage({ $: vi.fn().mockResolvedValue(handle) });
    expect(await resolveFrame(page, { selector: "iframe#pay" })).toBe(target);
    expect(page.$).toHaveBeenCalledWith("iframe#pay");
  });

  it("throws SelectorNotFoundError when the iframe selector matches nothing", async () => {
    const page = mockFramePage({ $: vi.fn().mockResolvedValue(null) });
    const err = await resolveFrame(page, { selector: "iframe#x" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(SelectorNotFoundError);
    expect(err).toMatchObject({ selector: "iframe#x", retryable: false });
  });

  it("throws SelectorNotFoundError when the matched element has no content frame", async () => {
    const handle = { contentFrame: vi.fn().mockResolvedValue(null) };
    const page = mockFramePage({ $: vi.fn().mockResolvedValue(handle) });
    await expect(
      resolveFrame(page, { selector: "div#notiframe" }),
    ).rejects.toBeInstanceOf(SelectorNotFoundError);
  });

  it("throws SelectorNotFoundError when no frame matches name/url", async () => {
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("a", "https://a")]),
    });
    await expect(resolveFrame(page, { name: "missing" })).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("throws SelectorNotFoundError when no frame matches a url-only query", async () => {
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("a", "https://a")]),
    });
    await expect(
      resolveFrame(page, { url: "missing.example" }),
    ).rejects.toBeInstanceOf(SelectorNotFoundError);
  });

  it("throws SelectorNotFoundError for an empty query", async () => {
    await expect(resolveFrame(mockFramePage(), {})).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("logs a step line on a name match", async () => {
    const logger = { log: vi.fn() };
    const page = mockFramePage({
      frames: vi.fn().mockReturnValue([frameStub("checkout", "https://pay")]),
    });
    await resolveFrame(page, { name: "checkout" }, { logger });
    expect(logger.log).toHaveBeenCalledWith("frame checkout", "step");
  });
});
