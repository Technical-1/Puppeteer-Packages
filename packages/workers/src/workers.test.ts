import { describe, it, expect, vi } from "vitest";
import type { Page, WebWorker } from "puppeteer-core";
import { listWorkers, evaluateInWorker } from "./workers.js";

function workerMock(url: string): WebWorker {
  return { url: vi.fn().mockReturnValue(url) } as unknown as WebWorker;
}
function pageWithWorkers(workers: WebWorker[]): Page {
  return { workers: vi.fn().mockReturnValue(workers) } as unknown as Page;
}

describe("listWorkers", () => {
  it("maps each live worker to a WorkerInfo", () => {
    const a = workerMock("blob:a");
    const b = workerMock("https://x/sw.js");
    const infos = listWorkers(pageWithWorkers([a, b]));
    expect(infos).toEqual([
      { url: "blob:a", worker: a },
      { url: "https://x/sw.js", worker: b },
    ]);
  });
  it("returns an empty array when the page has no workers", () => {
    expect(listWorkers(pageWithWorkers([]))).toEqual([]);
  });
});

function evalWorkerMock(
  impl: (fn: unknown, ...a: unknown[]) => Promise<unknown>,
  url = "blob:w",
): WebWorker {
  return {
    url: vi.fn().mockReturnValue(url),
    evaluate: vi.fn(impl),
  } as unknown as WebWorker;
}

describe("evaluateInWorker", () => {
  it("returns the worker's evaluate result and forwards args", async () => {
    const worker = evalWorkerMock(async () => 42);
    const result = await evaluateInWorker(worker, (a: number) => a, 21);
    expect(result).toBe(42);
    expect(worker.evaluate).toHaveBeenCalledWith(expect.any(Function), 21);
  });
  it("throws a retryable WorkerError with cause+context on rejection", async () => {
    const boom = new Error("worker destroyed");
    const worker = evalWorkerMock(() => Promise.reject(boom), "blob:dead");
    await expect(
      evaluateInWorker(worker, () => 1),
    ).rejects.toMatchObject({
      name: "WorkerError",
      retryable: true,
      message: "workers: evaluate in worker failed",
      context: { url: "blob:dead" },
    });
    await evaluateInWorker(worker, () => 1).catch((e: { cause?: unknown }) => {
      expect((e.cause as Error).message).toBe("worker destroyed");
    });
  });
});
