import { describe, it, expect, vi } from "vitest";
import { uploadFile, uploadViaFileChooser } from "./upload.js";
import { SelectorNotFoundError, TimeoutError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

function mockUploadPage(overrides: Record<string, unknown> = {}): Page {
  const handle = { uploadFile: vi.fn().mockResolvedValue(undefined) };
  return {
    _handle: handle,
    waitForSelector: vi.fn().mockResolvedValue(handle),
    click: vi.fn().mockResolvedValue(undefined),
    waitForFileChooser: vi
      .fn()
      .mockResolvedValue({ accept: vi.fn().mockResolvedValue(undefined) }),
    ...overrides,
  } as unknown as Page;
}

describe("uploadFile", () => {
  it("uploads a single file to the resolved input", async () => {
    const page = mockUploadPage();
    await uploadFile(page, "#file", "/tmp/a.png");
    expect(page.waitForSelector).toHaveBeenCalledWith(
      "#file",
      expect.objectContaining({ timeout: 15000 }),
    );
    expect((page as unknown as { _handle: { uploadFile: unknown } })._handle.uploadFile).toHaveBeenCalledWith(
      "/tmp/a.png",
    );
  });

  it("uploads multiple files", async () => {
    const page = mockUploadPage();
    await uploadFile(page, "#file", ["/a", "/b"]);
    expect((page as unknown as { _handle: { uploadFile: (...a: string[]) => void } })._handle.uploadFile).toHaveBeenCalledWith(
      "/a",
      "/b",
    );
  });

  it("does NOT require the input to be visible (hidden file inputs)", async () => {
    const page = mockUploadPage();
    await uploadFile(page, "#file", "/a");
    const call = (page.waitForSelector as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call?.[1]).not.toHaveProperty("visible", true);
  });

  it("throws SelectorNotFoundError when the input never appears", async () => {
    const page = mockUploadPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    const err = await uploadFile(page, "#missing", "/a").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SelectorNotFoundError);
    expect(err).toMatchObject({ selector: "#missing", retryable: false });
  });

  it("throws SelectorNotFoundError when waitForSelector resolves null", async () => {
    const page = mockUploadPage({
      waitForSelector: vi.fn().mockResolvedValue(null),
    });
    await expect(uploadFile(page, "#x", "/a")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("logs a step line", async () => {
    const logger = { log: vi.fn() };
    await uploadFile(mockUploadPage(), "#file", "/a", { logger });
    expect(logger.log).toHaveBeenCalledWith("upload #file", "step");
  });
});

describe("uploadViaFileChooser", () => {
  it("opens the chooser via the trigger click and accepts the files", async () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    const page = mockUploadPage({
      waitForFileChooser: vi.fn().mockResolvedValue({ accept }),
    });
    await uploadViaFileChooser(page, "#btn", ["/a", "/b"]);
    expect(page.click).toHaveBeenCalledWith("#btn");
    expect(accept).toHaveBeenCalledWith(["/a", "/b"]);
  });

  it("normalizes a single file path to an array for accept", async () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    const page = mockUploadPage({
      waitForFileChooser: vi.fn().mockResolvedValue({ accept }),
    });
    await uploadViaFileChooser(page, "#btn", "/only");
    expect(accept).toHaveBeenCalledWith(["/only"]);
  });

  it("throws SelectorNotFoundError when the trigger is absent", async () => {
    const page = mockUploadPage({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(
      uploadViaFileChooser(page, "#missing", "/a"),
    ).rejects.toBeInstanceOf(SelectorNotFoundError);
  });

  it("throws SelectorNotFoundError when the trigger resolves null", async () => {
    const page = mockUploadPage({
      waitForSelector: vi.fn().mockResolvedValue(null),
    });
    await expect(uploadViaFileChooser(page, "#x", "/a")).rejects.toBeInstanceOf(
      SelectorNotFoundError,
    );
  });

  it("wraps a chooser that never opens as a retryable TimeoutError", async () => {
    const page = mockUploadPage({
      waitForFileChooser: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    const err = await uploadViaFileChooser(page, "#btn", "/a").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err).toMatchObject({ retryable: true });
  });

  it("logs a step line", async () => {
    const logger = { log: vi.fn() };
    await uploadViaFileChooser(mockUploadPage(), "#btn", "/a", { logger });
    expect(logger.log).toHaveBeenCalledWith("upload via chooser #btn", "step");
  });
});
