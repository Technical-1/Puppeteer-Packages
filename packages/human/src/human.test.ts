import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { humanDelay, humanType, humanMouseMove } from "./human.js";
import type { Page } from "puppeteer-core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("humanDelay", () => {
  it("waits a delay within [minMs, maxMs] (deterministic via rand)", async () => {
    const p = humanDelay({ minMs: 100, maxMs: 200, rand: () => 0.5 });
    let done = false;
    void p.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(149);
    expect(done).toBe(false); // 150ms expected, not elapsed at 149
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });
});

describe("humanType", () => {
  it("focuses then types each character with a randomized per-key delay", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const type = vi.fn().mockResolvedValue(undefined);
    const page = { focus, keyboard: { type } } as unknown as Page;
    const p = humanType(page, "#in", "ab", {
      minKeyMs: 10,
      maxKeyMs: 20,
      rand: () => 0,
    });
    await vi.runAllTimersAsync();
    await p;
    expect(focus).toHaveBeenCalledWith("#in");
    expect(type).toHaveBeenCalledTimes(2);
    expect(type).toHaveBeenNthCalledWith(1, "a");
    expect(type).toHaveBeenNthCalledWith(2, "b");
  });
});

describe("humanMouseMove", () => {
  it("moves the mouse in N linear steps from start to end", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const page = { mouse: { move } } as unknown as Page;
    const p = humanMouseMove(
      page,
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { steps: 4 },
    );
    await vi.runAllTimersAsync();
    await p;
    expect(move).toHaveBeenCalledTimes(4);
    expect(move).toHaveBeenLastCalledWith(100, 100);
  });
});
