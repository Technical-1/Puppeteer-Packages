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

  it("uses default minMs=50 and maxMs=250 when no opts are provided", async () => {
    // rand=0 → delay = 50 + 0*(250-50) = 50ms; rand=1 → 250ms
    const pMin = humanDelay({ rand: () => 0 });
    let doneMin = false;
    void pMin.then(() => { doneMin = true; });
    await vi.advanceTimersByTimeAsync(49);
    expect(doneMin).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pMin;
    expect(doneMin).toBe(true);

    const pMax = humanDelay({ rand: () => 1 });
    let doneMax = false;
    void pMax.then(() => { doneMax = true; });
    await vi.advanceTimersByTimeAsync(249);
    expect(doneMax).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pMax;
    expect(doneMax).toBe(true);
  });

  it("resolves immediately when minMs equals maxMs (zero-range delay)", async () => {
    const p = humanDelay({ minMs: 100, maxMs: 100, rand: () => 0.5 });
    let done = false;
    void p.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(done).toBe(true);
  });

  it("falls back to Math.random when no rand is supplied", async () => {
    // Spy on Math.random to make the delay deterministic: 0.5 → 150ms in [50,250]
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const p = humanDelay();
    let done = false;
    void p.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(149);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    spy.mockRestore();
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

  it("focuses but issues no keyboard.type calls for empty text", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const type = vi.fn().mockResolvedValue(undefined);
    const page = { focus, keyboard: { type } } as unknown as Page;
    const p = humanType(page, "#in", "");
    await vi.runAllTimersAsync();
    await p;
    expect(focus).toHaveBeenCalledWith("#in");
    expect(type).not.toHaveBeenCalled();
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

  it("clamps steps to 1 when steps=0 is given, ending at the target", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const page = { mouse: { move } } as unknown as Page;
    const p = humanMouseMove(
      page,
      { x: 10, y: 20 },
      { x: 200, y: 300 },
      { steps: 0 },
    );
    await vi.runAllTimersAsync();
    await p;
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith(200, 300);
  });

  it("defaults to 12 steps when no opts are provided", async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const page = { mouse: { move } } as unknown as Page;
    const p = humanMouseMove(page, { x: 0, y: 0 }, { x: 120, y: 120 });
    await vi.runAllTimersAsync();
    await p;
    // default steps=12 → mouse.move called exactly 12 times
    expect(move).toHaveBeenCalledTimes(12);
    // final call lands exactly on the target
    expect(move).toHaveBeenLastCalledWith(120, 120);
  });
});
