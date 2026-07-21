import { describe, it, expect, vi } from "vitest";
import { extractPaginated } from "./paginate.js";
import type { Page } from "puppeteer-core";

function handle() {
  return { click: vi.fn().mockResolvedValue(undefined), dispose: vi.fn().mockResolvedValue(undefined) };
}
function mockPage(overrides: Record<string, unknown> = {}): Page {
  return { $: vi.fn(), evaluate: vi.fn(), ...overrides } as unknown as Page;
}

describe("extractPaginated", () => {
  it("aggregates results across pages until the next control disappears", async () => {
    const h1 = handle();
    const h2 = handle();
    const page = mockPage({
      $: vi.fn().mockResolvedValueOnce(h1).mockResolvedValueOnce(h2).mockResolvedValueOnce(null),
    });
    const extractFn = vi
      .fn<(page: Page) => Promise<string[]>>()
      .mockResolvedValueOnce(["a"])
      .mockResolvedValueOnce(["b"])
      .mockResolvedValueOnce(["c"]);
    const out = await extractPaginated(page, { nextSelector: ".next", extractFn, settleMs: 0 });
    expect(out).toEqual(["a", "b", "c"]);
    expect(extractFn).toHaveBeenCalledTimes(3);
    expect(h1.click).toHaveBeenCalledOnce();
    expect(h2.click).toHaveBeenCalledOnce();
    expect(h1.dispose).toHaveBeenCalledOnce();
  });

  it("stops at maxPages without clicking on the final page", async () => {
    const page = mockPage({ $: vi.fn().mockResolvedValue(handle()) });
    const extractFn = vi.fn<(page: Page) => Promise<string[]>>().mockResolvedValue(["x"]);
    const out = await extractPaginated(page, { nextSelector: ".next", extractFn, maxPages: 2, settleMs: 0 });
    expect(out).toEqual(["x", "x"]);
    // page1 clicks next, page2 == maxPages breaks before querying/clicking again → $ called once
    expect((page.$ as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it("handles a single page (no next control on the first page)", async () => {
    const page = mockPage({ $: vi.fn().mockResolvedValue(null) });
    const extractFn = vi.fn<(page: Page) => Promise<string[]>>().mockResolvedValue(["only"]);
    const out = await extractPaginated(page, { nextSelector: ".next", extractFn, settleMs: 0 });
    expect(out).toEqual(["only"]);
  });

  it("throws ConfigError (by name) when maxPages < 1", async () => {
    const page = mockPage();
    const extractFn = vi.fn<(page: Page) => Promise<string[]>>().mockResolvedValue([]);
    await expect(
      extractPaginated(page, { nextSelector: ".next", extractFn, maxPages: 0 }),
    ).rejects.toMatchObject({ name: "ConfigError", retryable: false });
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("wraps a click failure as a retryable PptrKitError and still disposes the handle", async () => {
    const bad = { click: vi.fn().mockRejectedValue(new Error("detached")), dispose: vi.fn().mockResolvedValue(undefined) };
    const page = mockPage({ $: vi.fn().mockResolvedValue(bad) });
    const extractFn = vi.fn<(page: Page) => Promise<string[]>>().mockResolvedValue(["a"]);
    await expect(
      extractPaginated(page, { nextSelector: ".next", extractFn, settleMs: 0 }),
    ).rejects.toMatchObject({ name: "PptrKitError", retryable: true });
    expect(bad.dispose).toHaveBeenCalledOnce();
  });

  it("emits logger step lines when a logger is injected", async () => {
    const log = vi.fn();
    const page = mockPage({ $: vi.fn().mockResolvedValue(null) });
    const extractFn = vi.fn<(page: Page) => Promise<string[]>>().mockResolvedValue([]);
    await extractPaginated(page, { nextSelector: ".next", extractFn, settleMs: 0, logger: { log } });
    expect(log).toHaveBeenCalled();
  });
});
