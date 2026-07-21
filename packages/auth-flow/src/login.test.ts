import { describe, it, expect, vi } from "vitest";
import type { Page } from "puppeteer-core";
import { login } from "./login.js";
import type { LoginSteps } from "./types.js";

const AUTH_SELECTOR = "#dashboard";

function pageMock(over: Partial<Record<string, unknown>> = {}): {
  page: Page;
  waitForSelector: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
  url: ReturnType<typeof vi.fn>;
} {
  const waitForSelector = vi.fn().mockResolvedValue({});
  const type = vi.fn().mockResolvedValue(undefined);
  const click = vi.fn().mockResolvedValue(undefined);
  const url = vi.fn().mockReturnValue("https://app.example.com/dashboard");
  const page = { waitForSelector, type, click, url, ...over } as unknown as Page;
  return { page, waitForSelector, type, click, url };
}

const steps: LoginSteps = {
  usernameSelector: "#user",
  username: "alice",
  passwordSelector: "#pass",
  password: "s3cret",
  submitSelector: "#submit",
  authenticated: { selector: AUTH_SELECTOR },
};

describe("login — selector happy path", () => {
  it("fills credentials, submits, waits for the authenticated selector", async () => {
    const { page, waitForSelector, type, click } = pageMock();

    const result = await login(page, steps);

    expect(type).toHaveBeenNthCalledWith(1, "#user", "alice", { delay: 0 });
    expect(type).toHaveBeenNthCalledWith(2, "#pass", "s3cret", { delay: 0 });
    expect(click).toHaveBeenCalledWith("#submit");
    expect(waitForSelector).toHaveBeenCalledWith(AUTH_SELECTOR, {
      visible: true,
      timeout: 30000,
    });
    expect(result).toEqual({
      url: "https://app.example.com/dashboard",
      mfaPerformed: false,
    });
  });

  it("passes typeDelay through to page.type", async () => {
    const { page, type } = pageMock();
    await login(page, steps, { typeDelay: 25 });
    expect(type).toHaveBeenNthCalledWith(1, "#user", "alice", { delay: 25 });
  });
});

describe("login — required-field errors", () => {
  it("throws SelectorNotFoundError when the username field never appears", async () => {
    const { page } = pageMock({
      waitForSelector: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    await expect(login(page, steps)).rejects.toMatchObject({
      name: "SelectorNotFoundError",
      selector: "#user",
    });
  });

  it("throws SelectorNotFoundError for a missing submit button", async () => {
    const waitForSelector = vi.fn((sel: string) =>
      sel === "#submit"
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve({}),
    );
    const { page } = pageMock({ waitForSelector });
    await expect(login(page, steps)).rejects.toMatchObject({
      name: "SelectorNotFoundError",
      selector: "#submit",
    });
  });
});

describe("login — selector auth timeout", () => {
  it("throws a retryable TimeoutError when the authenticated selector never shows", async () => {
    const waitForSelector = vi.fn((sel: string) =>
      sel === AUTH_SELECTOR
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve({}),
    );
    const { page } = pageMock({ waitForSelector });
    await expect(login(page, steps)).rejects.toMatchObject({
      name: "TimeoutError",
      retryable: true,
    });
  });
});

describe("login — urlPredicate auth-check", () => {
  const urlSteps: LoginSteps = {
    usernameSelector: "#user",
    username: "alice",
    passwordSelector: "#pass",
    password: "s3cret",
    submitSelector: "#submit",
    authenticated: { urlPredicate: (u) => u.includes("/dashboard") },
  };

  it("returns immediately when page.url() already satisfies the predicate", async () => {
    const url = vi.fn().mockReturnValue("https://app.example.com/dashboard");
    const { page } = pageMock({ url });
    const result = await login(page, urlSteps);
    expect(result.url).toBe("https://app.example.com/dashboard");
    expect(result.mfaPerformed).toBe(false);
  });

  it("polls page.url() until the predicate holds", async () => {
    const url = vi
      .fn()
      .mockReturnValueOnce("https://app.example.com/login")
      .mockReturnValue("https://app.example.com/dashboard");
    const { page } = pageMock({ url });
    const result = await login(page, urlSteps, { pollInterval: 1 });
    expect(result.url).toBe("https://app.example.com/dashboard");
    expect(url.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws a retryable TimeoutError when the predicate never satisfies", async () => {
    const url = vi.fn().mockReturnValue("https://app.example.com/login");
    const { page } = pageMock({ url });
    await expect(
      login(page, urlSteps, { authTimeout: 0, pollInterval: 1 }),
    ).rejects.toMatchObject({ name: "TimeoutError", retryable: true });
  });
});

describe("login — MFA step", () => {
  const base = {
    usernameSelector: "#user",
    username: "alice",
    passwordSelector: "#pass",
    password: "s3cret",
    submitSelector: "#submit",
    authenticated: { selector: "#dashboard" } as const,
  };

  it("types a string code into the OTP field and submits it", async () => {
    const { page, type, click } = pageMock();
    const result = await login(page, {
      ...base,
      mfa: { codeSelector: "#otp", code: "123456", submitSelector: "#otp-submit" },
    });
    expect(type).toHaveBeenCalledWith("#otp", "123456", { delay: 0 });
    expect(click).toHaveBeenCalledWith("#otp-submit");
    expect(result.mfaPerformed).toBe(true);
  });

  it("resolves an async code supplier before typing", async () => {
    const { page, type } = pageMock();
    const code = vi.fn().mockResolvedValue("999000");
    await login(page, { ...base, mfa: { codeSelector: "#otp", code } });
    expect(code).toHaveBeenCalledTimes(1);
    expect(type).toHaveBeenCalledWith("#otp", "999000", { delay: 0 });
  });

  it("waits for the MFA-ready state before entering the code", async () => {
    const { page, waitForSelector } = pageMock();
    await login(page, {
      ...base,
      mfa: { waitFor: { selector: "#otp-challenge" }, codeSelector: "#otp", code: "1" },
    });
    expect(waitForSelector).toHaveBeenCalledWith("#otp-challenge", {
      visible: true,
      timeout: 30000,
    });
  });

  it("throws SelectorNotFoundError when the OTP field never appears", async () => {
    const waitForSelector = vi.fn((sel: string) =>
      sel === "#otp"
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve({}),
    );
    const { page } = pageMock({ waitForSelector });
    await expect(
      login(page, { ...base, mfa: { codeSelector: "#otp", code: "1" } }),
    ).rejects.toMatchObject({ name: "SelectorNotFoundError", selector: "#otp" });
  });

  it("throws a retryable TimeoutError when the MFA-ready wait times out", async () => {
    const waitForSelector = vi.fn((sel: string) =>
      sel === "#otp-challenge"
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve({}),
    );
    const { page } = pageMock({ waitForSelector });
    await expect(
      login(page, { ...base, mfa: { waitFor: { selector: "#otp-challenge" } } }),
    ).rejects.toMatchObject({ name: "TimeoutError", retryable: true });
  });

  it("sets mfaPerformed:true even when mfa only waits (no code)", async () => {
    const { page } = pageMock();
    const result = await login(page, {
      ...base,
      mfa: { waitFor: { selector: "#otp-challenge" } },
    });
    expect(result.mfaPerformed).toBe(true);
  });
});

describe("login — logger", () => {
  it("logs step lines and a final success through the injected logger", async () => {
    const { page } = pageMock();
    const log = vi.fn();
    await login(
      page,
      {
        usernameSelector: "#user",
        username: "alice",
        passwordSelector: "#pass",
        password: "s3cret",
        submitSelector: "#submit",
        authenticated: { selector: "#dashboard" },
      },
      { logger: { log } },
    );
    expect(log).toHaveBeenCalledWith("auth-flow: authenticated", "success");
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("auth-flow: submitting"),
      "step",
    );
  });

  it("logs the MFA step line through the injected logger", async () => {
    const { page } = pageMock();
    const log = vi.fn();
    await login(
      page,
      {
        usernameSelector: "#user",
        username: "alice",
        passwordSelector: "#pass",
        password: "s3cret",
        submitSelector: "#submit",
        authenticated: { selector: "#dashboard" },
        mfa: { codeSelector: "#otp", code: "123456" },
      },
      { logger: { log } },
    );
    expect(log).toHaveBeenCalledWith("auth-flow: handling MFA step", "step");
  });
});
