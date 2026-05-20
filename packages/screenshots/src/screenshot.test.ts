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
});
