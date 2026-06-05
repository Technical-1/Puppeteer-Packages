import { describe, it, expect, vi } from "vitest";
import type { Page } from "puppeteer-core";
import { injectToken } from "./inject.js";

function pageMock(): Page {
  // The real in-page callback returns `true` on success — mirror the
  // runtime contract here so the implementation's `landed === false` check
  // exercises against a faithful boolean (not undefined).
  return {
    evaluate: vi.fn().mockResolvedValue(true),
  } as unknown as Page;
}

/**
 * Capture the callback that `injectToken` passes to `page.evaluate` and invoke
 * it with a fake `document`, letting us cover the in-page callback body in the
 * Node.js test environment (lines 32-36 of inject.ts).
 */
function makeCallbackCapturePage(): {
  page: Page;
  runCallback: (fakeDocument: { querySelector: (s: string) => { innerText: string } | null }) => boolean;
} {
  let capturedFn: ((sel: string, tok: string) => boolean) | undefined;
  let capturedSel = "";
  let capturedTok = "";

  const page = {
    evaluate: vi.fn().mockImplementation(
      async (fn: (sel: string, tok: string) => boolean, sel: string, tok: string) => {
        capturedFn = fn;
        capturedSel = sel;
        capturedTok = tok;
        return true; // default: report success to the outer code
      },
    ),
  } as unknown as Page;

  const g = globalThis as Record<string, unknown>;
  return {
    page,
    runCallback: (fakeDocument) => {
      if (!capturedFn) throw new Error("evaluate was not called yet");
      // Provide a local `document` binding to simulate the in-browser global.
      const hadDocument = Object.prototype.hasOwnProperty.call(g, "document");
      const prevDocument: unknown = g["document"];
      g["document"] = fakeDocument;
      try {
        return capturedFn(capturedSel, capturedTok);
      } finally {
        if (hadDocument) {
          g["document"] = prevDocument;
        } else {
          delete g["document"];
        }
      }
    },
  };
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

  describe("in-page callback body (lines 32-36)", () => {
    it("callback returns false when querySelector returns null (element absent)", async () => {
      const { page, runCallback } = makeCallbackCapturePage();
      await injectToken(page, "#absent", "TOKEN");
      const result = runCallback({ querySelector: () => null });
      expect(result).toBe(false);
    });

    it("callback sets innerText and returns true when element is found", async () => {
      const { page, runCallback } = makeCallbackCapturePage();
      await injectToken(page, "#target", "MY_TOKEN");
      const el: { innerText: string } = { innerText: "" };
      const result = runCallback({ querySelector: () => el });
      expect(result).toBe(true);
      expect(el.innerText).toBe("MY_TOKEN");
    });
  });
});
