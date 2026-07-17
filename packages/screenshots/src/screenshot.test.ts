import { describe, it, expect, vi } from "vitest";
import type { ElementHandle, Page } from "puppeteer-core";
import { screenshot, screenshotElement } from "./screenshot.js";

function pageMock(): Page {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.from("png-bytes")),
    $: vi.fn(),
  } as unknown as Page;
}

function elementMock(): ElementHandle {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.from("el-bytes")),
  } as unknown as ElementHandle;
}

describe("screenshot", () => {
  it("delegates to page.screenshot with the given options", async () => {
    const page = pageMock();
    const buf = await screenshot(page, { fullPage: true });

    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true });
    expect(buf).toEqual(Buffer.from("png-bytes"));
  });

  it("returns the Buffer when no path is supplied", async () => {
    const page = pageMock();
    const buf = await screenshot(page);
    expect(buf).toEqual(Buffer.from("png-bytes"));
  });

  it("wraps puppeteer failures in PptrKitError (retryable:true) with cause", async () => {
    const page = {
      screenshot: vi.fn().mockRejectedValue(new Error("frame detached")),
    } as unknown as Page;

    await expect(screenshot(page)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "frame detached" }),
    });
  });
});

describe("screenshotElement", () => {
  it("resolves the selector then calls element.screenshot with the options", async () => {
    const el = elementMock();
    const page = {
      $: vi.fn().mockResolvedValue(el),
    } as unknown as Page;

    const buf = await screenshotElement(page, "#hero", { type: "jpeg" });

    expect(page.$).toHaveBeenCalledWith("#hero");
    expect(el.screenshot).toHaveBeenCalledWith({ type: "jpeg" });
    expect(buf).toEqual(Buffer.from("el-bytes"));
  });

  it("throws SelectorNotFoundError (retryable:false) when the selector misses", async () => {
    const page = {
      $: vi.fn().mockResolvedValue(null),
    } as unknown as Page;

    await expect(screenshotElement(page, "#missing")).rejects.toMatchObject({
      name: "SelectorNotFoundError",
      retryable: false,
      selector: "#missing",
    });
  });

  it("wraps page.$() failure in PptrKitError (retryable:true) with cause (lines 41-42)", async () => {
    // page.$() itself throws — different error path from el === null
    const cause = new Error("page.$ exploded");
    const page = {
      $: vi.fn().mockRejectedValue(cause),
    } as unknown as Page;

    await expect(screenshotElement(page, "#btn")).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "page.$ exploded" }),
    });
  });

  it("wraps element.screenshot() failure in PptrKitError (retryable:true) with cause (lines 47-48)", async () => {
    // element.screenshot() throws after el is found
    const cause = new Error("element screenshot failed");
    const el = {
      screenshot: vi.fn().mockRejectedValue(cause),
    } as unknown as ElementHandle;
    const page = {
      $: vi.fn().mockResolvedValue(el),
    } as unknown as Page;

    await expect(screenshotElement(page, "#hero")).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "element screenshot failed" }),
    });
  });

  it("uses default empty opts when no options are supplied", async () => {
    const el = elementMock();
    const page = {
      $: vi.fn().mockResolvedValue(el),
    } as unknown as Page;

    await screenshotElement(page, "#hero");
    expect(el.screenshot).toHaveBeenCalledWith({});
  });
});

describe("encoding option is excluded from the typed surface", () => {
  it("rejects encoding:'base64' at the type level (return stays Uint8Array)", async () => {
    const page = pageMock();
    // @ts-expect-error encoding is Omit-ed: a base64 string return is not part of the contract
    const buf = await screenshot(page, { encoding: "base64", fullPage: true });
    // runtime still returns the mock bytes; the guarantee is purely at the type level
    expect(buf).toEqual(Buffer.from("png-bytes"));
  });

  it("rejects encoding:'base64' on screenshotElement too", async () => {
    const el = elementMock();
    const page = { $: vi.fn().mockResolvedValue(el) } as unknown as Page;
    // @ts-expect-error encoding is Omit-ed on the element path as well
    const buf = await screenshotElement(page, "#hero", { encoding: "base64" });
    expect(buf).toEqual(Buffer.from("el-bytes"));
  });
});
