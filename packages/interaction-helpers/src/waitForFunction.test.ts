import { describe, it, expect, vi } from "vitest";
import { waitForFunction } from "./waitForFunction.js";
import { DEFAULT_TIMEOUT } from "./helpers.js";
import type { Page } from "puppeteer-core";

function pageWith(wff: ReturnType<typeof vi.fn>): Page {
  return { waitForFunction: wff } as unknown as Page;
}

describe("waitForFunction", () => {
  it("resolves the JSHandle and forwards fn, {timeout, polling}, and args", async () => {
    const handle = { jsonValue: vi.fn() };
    const wff = vi.fn().mockResolvedValue(handle);
    const page = pageWith(wff);
    const log = vi.fn();
    const fn = () => true;

    const result = await waitForFunction(page, fn, {
      timeout: 5000,
      polling: "mutation",
      args: ["a", 1],
      logger: { log } as never,
    });

    expect(result).toBe(handle);
    expect(wff).toHaveBeenCalledWith(
      fn,
      { timeout: 5000, polling: "mutation" },
      "a",
      1,
    );
    expect(log).toHaveBeenCalledWith("waitForFunction", "step");
  });

  it("defaults timeout to DEFAULT_TIMEOUT, polling undefined, and no args", async () => {
    const wff = vi.fn().mockResolvedValue({});
    const page = pageWith(wff);
    await waitForFunction(page, "window.ready === true");
    expect(wff).toHaveBeenCalledWith("window.ready === true", {
      timeout: DEFAULT_TIMEOUT,
      polling: undefined,
    });
  });

  it("wraps a poll timeout as a retryable TimeoutError carrying the cause", async () => {
    const cause = new Error("Waiting failed: 15000ms exceeded");
    const wff = vi.fn().mockRejectedValue(cause);
    const page = pageWith(wff);

    const err = await waitForFunction(page, () => false).catch((e) => e);
    expect(err.name).toBe("TimeoutError");
    expect(err.retryable).toBe(true);
    expect(err.cause).toBe(cause);
    expect(err.context).toMatchObject({ timeout: DEFAULT_TIMEOUT });
  });

  it("wraps a non-timeout predicate error as a non-retryable PptrKitError carrying the cause", async () => {
    const cause = new Error("x is not defined");
    cause.name = "ReferenceError";
    const wff = vi.fn().mockRejectedValue(cause);
    const page = pageWith(wff);

    const err = await waitForFunction(page, () => false).catch((e) => e);
    expect(err.name).toBe("PptrKitError");
    expect(err.retryable).toBe(false);
    expect(err.cause).toBe(cause);
  });
});
