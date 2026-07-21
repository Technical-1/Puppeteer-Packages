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
    over.stopImpl ??
      (async () => ("stopValue" in over ? over.stopValue : new Uint8Array([1, 2, 3])))
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

describe("traceRun — option mapping", () => {
  it("passes categories, screenshots, and path to tracing.start", async () => {
    const { page, start } = pageMock();
    await traceRun(page, async () => 0, {
      categories: ["devtools.timeline", "disabled-by-default-v8.cpu_profiler"],
      screenshots: true,
      path: "/tmp/trace.json",
    });
    expect(start).toHaveBeenCalledWith({
      categories: ["devtools.timeline", "disabled-by-default-v8.cpu_profiler"],
      screenshots: true,
      path: "/tmp/trace.json",
    });
  });

  it("omits unset fields from the TracingOptions (no undefined keys)", async () => {
    const { page, start } = pageMock();
    await traceRun(page, async () => 0);
    expect(start).toHaveBeenCalledWith({});
  });

  it("echoes path back in the result when supplied", async () => {
    const { page } = pageMock();
    const result = await traceRun(page, async () => 0, { path: "/tmp/t.json" });
    expect(result.path).toBe("/tmp/t.json");
  });

  it("emits step and success log lines through the DI logger", async () => {
    const log = vi.fn();
    const { page } = pageMock();
    await traceRun(page, async () => 0, { logger: { log } });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("tracing"), "step");
    expect(log).toHaveBeenCalledWith(expect.any(String), "success");
  });
});

describe("traceRun — error wrapping", () => {
  it("wraps a tracing.start rejection as retryable PptrKitError and skips fn/stop", async () => {
    const startCause = new Error("already tracing");
    const fn = vi.fn(async () => 0);
    const { page, stop } = pageMock({
      startImpl: async () => {
        throw startCause;
      },
    });

    const err = await traceRun(page, fn).catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("PptrKitError");
    expect((err as { retryable: boolean }).retryable).toBe(true);
    expect((err as { cause?: unknown }).cause).toBe(startCause);
    expect(fn).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it("throws retryable PptrKitError when stop resolves undefined", async () => {
    const { page } = pageMock({ stopValue: undefined });
    const err = await traceRun(page, async () => 0).catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("PptrKitError");
    expect((err as { retryable: boolean }).retryable).toBe(true);
  });

  it("wraps a stop rejection (fn succeeded) as retryable PptrKitError with cause", async () => {
    const stopCause = new Error("stop exploded");
    const { page } = pageMock({
      stopImpl: async () => {
        throw stopCause;
      },
    });
    const err = await traceRun(page, async () => 0).catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("PptrKitError");
    expect((err as { retryable: boolean }).retryable).toBe(true);
    expect((err as { cause?: unknown }).cause).toBe(stopCause);
  });
});
