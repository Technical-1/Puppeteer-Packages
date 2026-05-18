import { describe, it, expect } from "vitest";
import {
  PptrKitError,
  SelectorNotFoundError,
  NavigationError,
  TimeoutError,
  CaptchaError,
  ProxyError,
  SessionError,
} from "./errors.js";

describe("PptrKitError", () => {
  it("is an Error with a name matching the subclass and defaults retryable=false", () => {
    const e = new PptrKitError("boom");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PptrKitError");
    expect(e.retryable).toBe(false);
    expect(e.context).toEqual({});
  });

  it("carries cause and context and an explicit retryable flag", () => {
    const cause = new Error("root");
    const e = new PptrKitError("wrap", { cause, retryable: true, context: { a: 1 } });
    expect(e.cause).toBe(cause);
    expect(e.retryable).toBe(true);
    expect(e.context).toEqual({ a: 1 });
  });

  it("does not set the cause property when no cause is provided", () => {
    const e = new PptrKitError("no cause");
    expect("cause" in e).toBe(false);
  });
});

describe("subclasses", () => {
  it("SelectorNotFoundError carries the selector and is terminal", () => {
    const e = new SelectorNotFoundError("#missing");
    expect(e).toBeInstanceOf(PptrKitError);
    expect(e.name).toBe("SelectorNotFoundError");
    expect(e.selector).toBe("#missing");
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("#missing");
  });

  it("NavigationError carries the url + cause and is retryable", () => {
    const cause = new Error("net");
    const e = new NavigationError("https://x.test", { cause });
    expect(e.url).toBe("https://x.test");
    expect(e.cause).toBe(cause);
    expect(e.retryable).toBe(true);
  });

  it("TimeoutError and ProxyError are retryable; CaptchaError and SessionError are terminal", () => {
    expect(new TimeoutError("slow").retryable).toBe(true);
    expect(new ProxyError("bad proxy").retryable).toBe(true);
    expect(new CaptchaError("blocked").retryable).toBe(false);
    expect(new SessionError("no session").retryable).toBe(false);
  });

  it("subclasses are instanceof Error and instanceof PptrKitError", () => {
    const e = new NavigationError("https://x.test");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(PptrKitError);
    expect(e).toBeInstanceOf(NavigationError);
  });

  it("a caller can override the per-subclass retryable default", () => {
    expect(new CaptchaError("x", { retryable: true }).retryable).toBe(true);
    expect(new NavigationError("https://x.test", { retryable: false }).retryable).toBe(false);
  });
});
