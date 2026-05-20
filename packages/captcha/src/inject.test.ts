import { describe, it, expect, vi } from "vitest";
import type { Page } from "puppeteer-core";
import { injectToken } from "./inject.js";

function pageMock(): Page {
  return {
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("injectToken", () => {
  it("passes selector + token to page.evaluate", async () => {
    const page = pageMock();
    await injectToken(page, "#g-recaptcha-response", "TOKEN_X");

    expect(page.evaluate).toHaveBeenCalledOnce();
    const [fn, sel, tok] = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(typeof fn).toBe("function");
    expect(sel).toBe("#g-recaptcha-response");
    expect(tok).toBe("TOKEN_X");
  });

  it("throws CaptchaError (retryable:false) when the selector misses", async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(false), // callback returns false on miss
    } as unknown as Page;

    await expect(injectToken(page, "#missing", "T")).rejects.toMatchObject({
      name: "CaptchaError",
      retryable: false,
    });
  });

  it("wraps puppeteer evaluate failures in CaptchaError (retryable:false)", async () => {
    const page = {
      evaluate: vi.fn().mockRejectedValue(new Error("frame detached")),
    } as unknown as Page;

    await expect(injectToken(page, "#x", "T")).rejects.toMatchObject({
      name: "CaptchaError",
      retryable: false,
      cause: expect.objectContaining({ message: "frame detached" }),
    });
  });
});
