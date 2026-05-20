import { describe, it, expect, vi } from "vitest";
import type { Page } from "puppeteer-core";
import { pageToPdf } from "./pdf.js";

function pageMock(): Page {
  return {
    pdf: vi.fn().mockResolvedValue(Buffer.from("pdf-bytes")),
  } as unknown as Page;
}

describe("pageToPdf", () => {
  it("merges defaults with caller options (caller wins)", async () => {
    const page = pageMock();
    await pageToPdf(page, { format: "Letter" });

    expect(page.pdf).toHaveBeenCalledWith({
      format: "Letter",
      printBackground: true,
      margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
    });
  });

  it("uses the sane defaults when no options are passed", async () => {
    const page = pageMock();
    await pageToPdf(page);

    expect(page.pdf).toHaveBeenCalledWith({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", bottom: "1cm", left: "1cm", right: "1cm" },
    });
  });

  it("returns the Buffer from page.pdf", async () => {
    const page = pageMock();
    const buf = await pageToPdf(page);
    expect(buf).toEqual(Buffer.from("pdf-bytes"));
  });

  it("wraps puppeteer failures in PptrKitError (retryable:true) with cause", async () => {
    const page = {
      pdf: vi.fn().mockRejectedValue(new Error("not in headless mode")),
    } as unknown as Page;

    await expect(pageToPdf(page)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: expect.objectContaining({ message: "not in headless mode" }),
    });
  });
});
