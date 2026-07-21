import { describe, it, expect, vi } from "vitest";
import { readClipboard, writeClipboard } from "./clipboard.js";
import type { Page } from "puppeteer-core";

function pageWith(opts: {
  url?: string;
  overridePermissions?: ReturnType<typeof vi.fn>;
  evaluate?: ReturnType<typeof vi.fn>;
}): { page: Page; override: ReturnType<typeof vi.fn>; evaluate: ReturnType<typeof vi.fn> } {
  const override = opts.overridePermissions ?? vi.fn().mockResolvedValue(undefined);
  const evaluate = opts.evaluate ?? vi.fn().mockResolvedValue(undefined);
  const page = {
    url: () => opts.url ?? "https://example.com/page",
    browserContext: () => ({ overridePermissions: override }),
    evaluate,
  } as unknown as Page;
  return { page, override, evaluate };
}

describe("readClipboard", () => {
  it("grants clipboard-read on the page origin and returns the text", async () => {
    const { page, override, evaluate } = pageWith({
      url: "https://shop.example.com/cart",
      evaluate: vi.fn().mockResolvedValue("copied!"),
    });
    const log = vi.fn();
    const text = await readClipboard(page, { logger: { log } as never });

    expect(text).toBe("copied!");
    expect(override).toHaveBeenCalledWith("https://shop.example.com", ["clipboard-read"]);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("readClipboard", "step");
  });

  it("throws ConfigError on a non-secure origin (about:blank)", async () => {
    const { page, override } = pageWith({ url: "about:blank" });
    const err = await readClipboard(page).catch((e) => e);
    expect(err.name).toBe("ConfigError");
    expect(err.retryable).toBe(false);
    expect(override).not.toHaveBeenCalled();
  });

  it("wraps a permission/evaluate rejection as a non-retryable PptrKitError", async () => {
    const cause = new Error("Clipboard read blocked");
    const { page } = pageWith({ evaluate: vi.fn().mockRejectedValue(cause) });
    const err = await readClipboard(page).catch((e) => e);
    expect(err.name).toBe("PptrKitError");
    expect(err.retryable).toBe(false);
    expect(err.cause).toBe(cause);
  });
});

describe("writeClipboard", () => {
  it("grants clipboard-write on the origin and writes via evaluate", async () => {
    const { page, override, evaluate } = pageWith({ url: "https://a.example.com/x" });
    await writeClipboard(page, "hello");
    expect(override).toHaveBeenCalledWith("https://a.example.com", [
      "clipboard-read",
      "clipboard-write",
    ]);
    // evaluate is called with the in-page writer and the text arg
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate.mock.calls[0]![1]).toBe("hello");
  });

  it("throws ConfigError on a file: origin", async () => {
    const { page } = pageWith({ url: "file:///tmp/x.html" });
    const err = await writeClipboard(page, "hi").catch((e) => e);
    expect(err.name).toBe("ConfigError");
  });
});
