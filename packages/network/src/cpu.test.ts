import { describe, it, expect, vi } from "vitest";
import type { CDPSession, Page } from "puppeteer-core";
import { NetworkError } from "@technical-1/core";
import { throttleCPU } from "./cpu.js";

function pageMock() {
  const send = vi.fn().mockResolvedValue(undefined);
  const session = { send } as unknown as CDPSession;
  const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
  const page = { target: () => target } as unknown as Page;
  return { page, send, target };
}

describe("throttleCPU", () => {
  it("sends Emulation.setCPUThrottlingRate with the rate", async () => {
    const { page, send } = pageMock();
    await throttleCPU(page, 4);
    expect(send).toHaveBeenCalledWith("Emulation.setCPUThrottlingRate", { rate: 4 });
  });

  it("rate 1 disables throttling (still a valid send)", async () => {
    const { page, send } = pageMock();
    await throttleCPU(page, 1);
    expect(send).toHaveBeenCalledWith("Emulation.setCPUThrottlingRate", { rate: 1 });
  });

  it("throws NetworkError (retryable:false) for rate < 1", async () => {
    const { page, send } = pageMock();
    await expect(throttleCPU(page, 0)).rejects.toBeInstanceOf(NetworkError);
    await expect(throttleCPU(page, 0.5)).rejects.toMatchObject({ name: "NetworkError", retryable: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("wraps a CDP failure in NetworkError (retryable:true) and preserves the cause", async () => {
    const send = vi.fn().mockRejectedValue(new Error("CDP closed"));
    const session = { send } as unknown as CDPSession;
    const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
    const page = { target: () => target } as unknown as Page;

    await expect(throttleCPU(page, 4)).rejects.toMatchObject({
      name: "NetworkError",
      retryable: true,
      cause: expect.objectContaining({ message: "CDP closed" }),
    });
  });

  it("evicts the cached session on failure so a retry re-attaches", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("CDP closed")).mockResolvedValueOnce(undefined);
    const session = { send } as unknown as CDPSession;
    const target = { createCDPSession: vi.fn().mockResolvedValue(session) };
    const page = { target: () => target } as unknown as Page;

    await expect(throttleCPU(page, 4)).rejects.toBeInstanceOf(NetworkError);
    expect(target.createCDPSession).toHaveBeenCalledTimes(1);
    await throttleCPU(page, 2);
    expect(target.createCDPSession).toHaveBeenCalledTimes(2);
  });

  it("logs via an injected logger when provided", async () => {
    const { page } = pageMock();
    const log = vi.fn();
    await throttleCPU(page, 4, { logger: { log } });
    expect(log).toHaveBeenCalledWith("throttleCPU: rate=4", "debug");
  });

  it("reuses one session across repeat calls on the same page (no leak)", async () => {
    const { page, target } = pageMock();
    await throttleCPU(page, 2);
    await throttleCPU(page, 4);
    await throttleCPU(page, 1);
    expect(target.createCDPSession).toHaveBeenCalledTimes(1);
  });
});
