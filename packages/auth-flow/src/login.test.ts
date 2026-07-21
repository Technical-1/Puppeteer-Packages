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
