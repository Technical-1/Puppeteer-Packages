import { describe, it, expect, vi } from "vitest";
import type { Page, TracingOptions } from "puppeteer-core";
import { traceRun } from "./tracing.js";

/** Page mock exposing a controllable `tracing` sub-object. */
function pageMock(
  over: {
    stopValue?: Uint8Array | undefined;
    startImpl?: (o?: TracingOptions) => Promise<void>;
    stopImpl?: () => Promise<Uint8Array | undefined>;
  } = {}
): {
  page: Page;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  const start = vi.fn(over.startImpl ?? (async () => {}));
  const stop = vi.fn(
    over.stopImpl ?? (async () => over.stopValue ?? new Uint8Array([1, 2, 3]))
  );
  const page = { tracing: { start, stop } } as unknown as Page;
  return { page, start, stop };
}

describe("traceRun — happy path", () => {
  it("starts, runs fn, stops, and returns value + trace buffer", async () => {
    const buf = new Uint8Array([9, 8, 7]);
    const { page, start, stop } = pageMock({ stopValue: buf });

    const fn = vi.fn(async () => "title");
    const result = await traceRun(page, fn);

    expect(start).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(page);
    expect(stop).toHaveBeenCalledTimes(1);
    // start happens before fn, fn before stop:
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(
      fn.mock.invocationCallOrder[0]!
    );
    expect(fn.mock.invocationCallOrder[0]).toBeLessThan(
      stop.mock.invocationCallOrder[0]!
    );
    expect(result.value).toBe("title");
    expect(result.trace).toBe(buf);
    expect(result.path).toBeUndefined();
  });

  it("supports a synchronous fn", async () => {
    const { page } = pageMock();
    const result = await traceRun(page, () => 42);
    expect(result.value).toBe(42);
    expect(result.trace).toBeInstanceOf(Uint8Array);
  });
});

describe("traceRun — guaranteed stop", () => {
  it("stops the trace and re-throws fn's original error", async () => {
    const { page, stop } = pageMock();
    const boom = new Error("fn blew up");

    await expect(
      traceRun(page, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("does not mask fn's error when stop also fails during unwind", async () => {
    const boom = new Error("fn blew up");
    const { page, stop } = pageMock({
      stopImpl: async () => {
        throw new Error("stop failed");
      },
    });

    await expect(
      traceRun(page, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("logs a warning when stop fails during error unwind", async () => {
    const boom = new Error("fn blew up");
    const warn = vi.fn();
    const logger = {
      log: vi.fn((_m: string, level?: string) => {
        if (level === "warn") warn();
      }),
    };
    const { page } = pageMock({
      stopImpl: async () => {
        throw new Error("stop failed");
      },
    });

    await expect(
      traceRun(
        page,
        async () => {
          throw boom;
        },
        { logger }
      )
    ).rejects.toBe(boom);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
