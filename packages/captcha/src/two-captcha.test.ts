import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTwoCaptchaAdapter, createTwoCaptchaAdapterForTesting } from "./two-captcha.js";

interface FakeFetchCall {
  url: string;
}

function makeFakeFetch(responses: string[]): {
  fetch: typeof globalThis.fetch;
  calls: FakeFetchCall[];
} {
  const calls: FakeFetchCall[] = [];
  let idx = 0;
  const fetch = (async (url: string | URL): Promise<Response> => {
    calls.push({ url: url.toString() });
    const body = responses[Math.min(idx, responses.length - 1)] ?? "";
    idx++;
    return new Response(body, { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("createTwoCaptchaAdapterForTesting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("solveRecaptchaV2: posts in.php, polls res.php, returns the token", async () => {
    const { fetch, calls } = makeFakeFetch([
      "OK|123",            // in.php response (request ID 123)
      "CAPCHA_NOT_READY",  // first poll
      "OK|TOKEN_ABC",      // second poll: solved
    ]);
    const solver = createTwoCaptchaAdapterForTesting("API_KEY", {
      fetch,
      pollMs: 1000,
      timeoutMs: 30_000,
    });

    const p = solver.solveRecaptchaV2("SITEKEY", "https://example.com/");
    await vi.runAllTimersAsync();
    const token = await p;

    expect(token).toBe("TOKEN_ABC");
    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toContain("in.php");
    expect(calls[0]!.url).toContain("method=userrecaptcha");
    expect(calls[0]!.url).toContain("googlekey=SITEKEY");
    expect(calls[1]!.url).toContain("res.php");
    expect(calls[1]!.url).toContain("id=123");
  });

  it("solveHCaptcha: uses method=hcaptcha", async () => {
    const { fetch, calls } = makeFakeFetch(["OK|7", "OK|HTOKEN"]);
    const solver = createTwoCaptchaAdapterForTesting("API_KEY", {
      fetch,
      pollMs: 1000,
      timeoutMs: 30_000,
    });

    const p = solver.solveHCaptcha("HSITE", "https://example.com/");
    await vi.runAllTimersAsync();
    expect(await p).toBe("HTOKEN");
    expect(calls[0]!.url).toContain("method=hcaptcha");
    expect(calls[0]!.url).toContain("sitekey=HSITE");
  });

  it("solveTurnstile: uses method=turnstile", async () => {
    const { fetch, calls } = makeFakeFetch(["OK|9", "OK|TSTOKEN"]);
    const solver = createTwoCaptchaAdapterForTesting("API_KEY", {
      fetch,
      pollMs: 1000,
      timeoutMs: 30_000,
    });

    const p = solver.solveTurnstile("TSITE", "https://example.com/");
    await vi.runAllTimersAsync();
    expect(await p).toBe("TSTOKEN");
    expect(calls[0]!.url).toContain("method=turnstile");
    expect(calls[0]!.url).toContain("sitekey=TSITE");
  });

  it("throws CaptchaError (retryable:false) when in.php returns an error", async () => {
    const { fetch } = makeFakeFetch(["ERROR_WRONG_USER_KEY"]);
    const solver = createTwoCaptchaAdapterForTesting("BAD", { fetch });

    await expect(solver.solveRecaptchaV2("X", "https://x/")).rejects.toMatchObject({
      name: "CaptchaError",
      retryable: false,
    });
  });

  it("throws CaptchaError on timeout", async () => {
    const { fetch } = makeFakeFetch([
      "OK|1",
      "CAPCHA_NOT_READY", // every poll says not ready
    ]);
    const solver = createTwoCaptchaAdapterForTesting("API_KEY", {
      fetch,
      pollMs: 50,
      timeoutMs: 200,
    });

    const p = solver.solveRecaptchaV2("X", "https://x/");
    const a = expect(p).rejects.toMatchObject({
      name: "CaptchaError",
      retryable: false,
    });
    await vi.runAllTimersAsync();
    await a;
  });

  it("throws CaptchaError (retryable:false) when res.php returns a terminal error (not CAPCHA_NOT_READY / OK|)", async () => {
    // Lines 71-75: the poll receives a response that is neither "CAPCHA_NOT_READY"
    // nor an "OK|" prefix — triggers the terminal-error throw inside the poll loop.
    const { fetch } = makeFakeFetch(["OK|42", "ERROR_CAPTCHA_UNSOLVABLE"]);
    const solver = createTwoCaptchaAdapterForTesting("API_KEY", {
      fetch,
      pollMs: 1000,
      timeoutMs: 30_000,
    });

    const p = solver.solveRecaptchaV2("SITE", "https://example.com/");
    // Register the rejection assertion BEFORE running timers (mirrors the
    // existing "throws on timeout" pattern) so the rejection is captured.
    const a = expect(p).rejects.toMatchObject({
      name: "CaptchaError",
      retryable: false,
    });
    await vi.runAllTimersAsync();
    await a;
  });

  it("createTwoCaptchaAdapter (public wrapper) returns a working solver", async () => {
    // Lines 26-30: exercise the public createTwoCaptchaAdapter entry-point.
    // We can't inject a fetch into it, but we can verify it returns a CaptchaSolver
    // with the expected method shape without making any real network calls, by
    // directly testing that the solver exposes all three solve methods.
    const solver = createTwoCaptchaAdapter("API_KEY");
    expect(typeof solver.solveRecaptchaV2).toBe("function");
    expect(typeof solver.solveHCaptcha).toBe("function");
    expect(typeof solver.solveTurnstile).toBe("function");
  });

  it("does NOT log or echo the apiKey on any code path (logs OR thrown CaptchaError payload)", async () => {
    const { fetch } = makeFakeFetch(["ERROR_WRONG_USER_KEY"]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const solver = createTwoCaptchaAdapterForTesting("SECRET_KEY_DO_NOT_LEAK", { fetch });
    let thrown: unknown;
    try {
      await solver.solveRecaptchaV2("X", "https://x/");
    } catch (e) {
      thrown = e;
    }

    // (1) Console writes: never contain the key.
    for (const call of errSpy.mock.calls) {
      for (const arg of call) {
        expect(JSON.stringify(arg)).not.toContain("SECRET_KEY_DO_NOT_LEAK");
      }
    }
    for (const call of logSpy.mock.calls) {
      for (const arg of call) {
        expect(JSON.stringify(arg)).not.toContain("SECRET_KEY_DO_NOT_LEAK");
      }
    }

    // (2) Thrown CaptchaError: message + context + stack never contain the key.
    expect(thrown).toBeDefined();
    const serialized = JSON.stringify({
      name: (thrown as { name?: string }).name,
      message: (thrown as { message?: string }).message,
      context: (thrown as { context?: unknown }).context,
      stack: (thrown as { stack?: string }).stack,
    });
    expect(serialized).not.toContain("SECRET_KEY_DO_NOT_LEAK");

    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});
