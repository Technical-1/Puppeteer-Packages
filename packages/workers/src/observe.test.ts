import { describe, it, expect, vi } from "vitest";
import type { Page, WebWorker } from "puppeteer-core";
import { observeWorkers } from "./observe.js";

function workerMock(url: string): WebWorker {
  return { url: vi.fn().mockReturnValue(url) } as unknown as WebWorker;
}
function pageMock() {
  const handlers: Record<string, (w: WebWorker) => void> = {};
  const off = vi.fn();
  const on = vi.fn((event: string, fn: (w: WebWorker) => void) => {
    handlers[event] = fn;
  });
  const page = { on, off } as unknown as Page;
  return {
    page,
    off,
    fireCreated: (w: WebWorker) => handlers["workercreated"]?.(w),
    fireDestroyed: (w: WebWorker) => handlers["workerdestroyed"]?.(w),
  };
}

describe("observeWorkers — lifecycle", () => {
  it("records created workers and calls onWorkerCreated", () => {
    const { page, fireCreated } = pageMock();
    const onWorkerCreated = vi.fn();
    const obs = observeWorkers(page, { onWorkerCreated });
    const w = workerMock("blob:a");
    fireCreated(w);
    expect(obs.events).toEqual([{ kind: "created", url: "blob:a", worker: w }]);
    expect(obs.created).toEqual([{ url: "blob:a", worker: w }]);
    expect(onWorkerCreated).toHaveBeenCalledWith({ url: "blob:a", worker: w });
  });

  it("records destroyed workers and removes them from created", () => {
    const { page, fireCreated, fireDestroyed } = pageMock();
    const onWorkerDestroyed = vi.fn();
    const obs = observeWorkers(page, { onWorkerDestroyed });
    const w = workerMock("blob:a");
    fireCreated(w);
    fireDestroyed(w);
    expect(obs.created).toEqual([]);
    expect(obs.events).toEqual([
      { kind: "created", url: "blob:a", worker: w },
      { kind: "destroyed", url: "blob:a", worker: w },
    ]);
    expect(onWorkerDestroyed).toHaveBeenCalledWith({ url: "blob:a", worker: w });
  });

  it("logs a step line through the injected logger on create", () => {
    const { page, fireCreated } = pageMock();
    const log = vi.fn();
    observeWorkers(page, { logger: { log } });
    fireCreated(workerMock("blob:a"));
    expect(log).toHaveBeenCalledWith('workers: created "blob:a"', "step");
  });
});

describe("observeWorkers — consumer isolation", () => {
  it("routes a throwing onWorkerCreated to onError as retryable WorkerError, record kept", () => {
    const { page, fireCreated } = pageMock();
    const onError = vi.fn();
    const obs = observeWorkers(page, {
      onWorkerCreated: () => {
        throw new Error("consumer boom");
      },
      onError,
    });
    const w = workerMock("blob:a");
    expect(() => fireCreated(w)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as {
      name: string;
      retryable: boolean;
      cause?: unknown;
      context: Record<string, unknown>;
    };
    expect(err.name).toBe("WorkerError");
    expect(err.retryable).toBe(true);
    expect((err.cause as Error).message).toBe("consumer boom");
    expect(err.context).toEqual({ kind: "created", url: "blob:a" });
    expect(obs.created).toEqual([{ url: "blob:a", worker: w }]);
  });

  it("logs the error through the injected logger when a consumer callback throws", () => {
    const { page, fireCreated } = pageMock();
    const log = vi.fn();
    const onError = vi.fn();
    observeWorkers(page, {
      logger: { log },
      onWorkerCreated: () => {
        throw new Error("consumer boom");
      },
      onError,
    });
    const w = workerMock("blob:a");
    expect(() => fireCreated(w)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as {
      name: string;
      retryable: boolean;
      message: string;
      context: Record<string, unknown>;
    };
    expect(err.name).toBe("WorkerError");
    expect(err.retryable).toBe(true);
    expect(err.context).toEqual({ kind: "created", url: "blob:a" });
    expect(log).toHaveBeenCalledWith(
      "workers: consumer callback threw for created worker",
      "error",
    );
  });
});

describe("observeWorkers — disposal", () => {
  it("detaches both listeners on dispose and is idempotent", () => {
    const { page, off } = pageMock();
    const obs = observeWorkers(page);
    obs.dispose();
    obs.dispose();
    expect(off).toHaveBeenCalledTimes(2);
    expect(off).toHaveBeenCalledWith("workercreated", expect.any(Function));
    expect(off).toHaveBeenCalledWith("workerdestroyed", expect.any(Function));
  });
});
