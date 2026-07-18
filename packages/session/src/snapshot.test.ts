import { describe, it, expect, vi } from "vitest";
import type { BrowserContext, Cookie, Page } from "puppeteer-core";
import { captureSession, restoreSession } from "./snapshot.js";

// Cookie fixture — sourceScheme must be one of "Unset" | "NonSecure" | "Secure"
// per puppeteer-core 24.x's CookieSourceScheme enum. Cast via `unknown` because
// the strict `Cookie` type carries a handful of optional fields irrelevant to
// these tests.
const sampleCookies: Cookie[] = [
  {
    name: "sid",
    value: "abc",
    domain: "example.com",
    path: "/",
    expires: -1,
    size: 0,
    httpOnly: false,
    secure: false,
    session: true,
    sameParty: false,
    sourceScheme: "NonSecure",
    sourcePort: 80,
  } as unknown as Cookie,
];

function pageMock(opts: {
  cookies?: Cookie[];
  storage?: { local: Record<string, string>; session: Record<string, string>; origin: string };
} = {}): Page {
  const ctx = {
    cookies: vi.fn().mockResolvedValue(opts.cookies ?? []),
    setCookie: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;
  return {
    browserContext: () => ctx,
    evaluate: vi.fn().mockResolvedValue(
      opts.storage ?? { local: {}, session: {}, origin: "https://example.com" },
    ),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe("captureSession", () => {
  it("returns cookies + localStorage + sessionStorage + capturedAt", async () => {
    const page = pageMock({
      cookies: sampleCookies,
      storage: { local: { foo: "1" }, session: { bar: "2" }, origin: "https://example.com" },
    });

    const snap = await captureSession(page);

    expect(snap.cookies).toEqual(sampleCookies);
    expect(snap.localStorage).toEqual({ foo: "1" });
    expect(snap.sessionStorage).toEqual({ bar: "2" });
    expect(snap.origin).toBe("https://example.com");
    expect(new Date(snap.capturedAt).toString()).not.toBe("Invalid Date");
  });

  it("wraps puppeteer errors in SessionError with retryable:false and cause", async () => {
    const ctx = {
      cookies: vi.fn().mockRejectedValue(new Error("CDP closed")),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluate: vi.fn(),
    } as unknown as Page;

    await expect(captureSession(page)).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });

  it("returns empty localStorage and sessionStorage when page has none", async () => {
    const page = pageMock({ cookies: [], storage: { local: {}, session: {}, origin: "https://example.com" } });
    const snap = await captureSession(page);
    expect(snap.cookies).toEqual([]);
    expect(snap.localStorage).toEqual({});
    expect(snap.sessionStorage).toEqual({});
  });

  it("wraps page.evaluate errors in SessionError", async () => {
    const ctx = {
      cookies: vi.fn().mockResolvedValue([]),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluate: vi.fn().mockRejectedValue(new Error("evaluate failed")),
    } as unknown as Page;

    await expect(captureSession(page)).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "evaluate failed" }),
    });
  });
});

describe("restoreSession", () => {
  it("calls ctx.setCookie with the spread snapshot cookies + writes storage via evaluateOnNewDocument", async () => {
    const page = pageMock();
    await restoreSession(page, {
      cookies: sampleCookies,
      localStorage: { foo: "1" },
      sessionStorage: { bar: "2" },
      origin: "https://example.com",
      capturedAt: new Date().toISOString(),
    });

    expect(page.browserContext().setCookie).toHaveBeenCalledWith(...sampleCookies);
    expect(page.evaluateOnNewDocument).toHaveBeenCalledOnce();
    // Pin the argument contract — guards against accidental arg-order swap
    // or wrong-variable regressions inside restoreSession.
    expect(page.evaluateOnNewDocument).toHaveBeenCalledWith(
      expect.any(Function),
      { foo: "1" },
      { bar: "2" },
      "https://example.com",
    );
  });

  it("injected script writes nothing when the current origin does not match the snapshot origin", async () => {
    const page = pageMock();
    await restoreSession(page, {
      cookies: [],
      localStorage: { tok: "abc" },
      sessionStorage: { s: "1" },
      origin: "https://app.example.com",
      capturedAt: new Date().toISOString(),
    });

    const call = (page.evaluateOnNewDocument as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [fn, local, session, origin] = call as [
      (l: Record<string, string>, s: Record<string, string>, o: string) => void,
      Record<string, string>,
      Record<string, string>,
      string,
    ];

    const writtenLocal: Array<[string, string]> = [];
    const writtenSession: Array<[string, string]> = [];
    const g = globalThis as Record<string, unknown>;
    const prev = { location: g["location"], localStorage: g["localStorage"], sessionStorage: g["sessionStorage"] };
    g["localStorage"] = { setItem: (k: string, v: string) => writtenLocal.push([k, v]) };
    g["sessionStorage"] = { setItem: (k: string, v: string) => writtenSession.push([k, v]) };
    try {
      // foreign origin → early return, no writes
      g["location"] = { origin: "https://evil.example.com" };
      fn(local, session, origin);
      expect(writtenLocal).toEqual([]);
      expect(writtenSession).toEqual([]);

      // matching origin → writes land
      g["location"] = { origin: "https://app.example.com" };
      fn(local, session, origin);
      expect(writtenLocal).toEqual([["tok", "abc"]]);
      expect(writtenSession).toEqual([["s", "1"]]);
    } finally {
      g["location"] = prev.location;
      g["localStorage"] = prev.localStorage;
      g["sessionStorage"] = prev.sessionStorage;
    }
  });

  it("skips setCookie when snapshot has no cookies (puppeteer rejects empty rest args on some versions)", async () => {
    const page = pageMock();
    await restoreSession(page, {
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      origin: "https://example.com",
      capturedAt: new Date().toISOString(),
    });

    expect(page.browserContext().setCookie).not.toHaveBeenCalled();
  });

  it("wraps puppeteer errors in SessionError with retryable:false and cause", async () => {
    const ctx = {
      setCookie: vi.fn().mockRejectedValue(new Error("frame detached")),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluateOnNewDocument: vi.fn(),
    } as unknown as Page;

    await expect(
      restoreSession(page, {
        cookies: sampleCookies,
        localStorage: {},
        sessionStorage: {},
        origin: "https://example.com",
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "frame detached" }),
    });
  });

  it("error message includes cookie count and storage key counts", async () => {
    const ctx = {
      setCookie: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluateOnNewDocument: vi.fn(),
    } as unknown as Page;

    await expect(
      restoreSession(page, {
        cookies: sampleCookies,
        localStorage: { a: "1", b: "2" },
        sessionStorage: { c: "3" },
        origin: "https://example.com",
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      name: "SessionError",
      message: expect.stringContaining("cookies: 1"),
    });
  });

  it("evaluateOnNewDocument error is wrapped in SessionError", async () => {
    const ctx = {
      setCookie: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;
    const page = {
      browserContext: () => ctx,
      evaluateOnNewDocument: vi.fn().mockRejectedValue(new Error("eval failed")),
    } as unknown as Page;

    await expect(
      restoreSession(page, {
        cookies: sampleCookies,
        localStorage: {},
        sessionStorage: {},
        origin: "https://example.com",
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      name: "SessionError",
      retryable: false,
      cause: expect.objectContaining({ message: "eval failed" }),
    });
  });
});
