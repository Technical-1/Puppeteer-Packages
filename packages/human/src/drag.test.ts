import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dragAndDrop } from "./drag.js";
import type { Page } from "puppeteer-core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function elementWithBox(box: { x: number; y: number; width: number; height: number } | null) {
  return { boundingBox: vi.fn().mockResolvedValue(box) };
}

describe("dragAndDrop", () => {
  it("sequences move→down→interpolated moves→up between element centres", async () => {
    const src = elementWithBox({ x: 0, y: 0, width: 100, height: 100 }); // centre 50,50
    const tgt = elementWithBox({ x: 200, y: 200, width: 100, height: 100 }); // centre 250,250
    const $ = vi.fn(async (sel: string) => (sel === "#src" ? src : tgt));
    const move = vi.fn().mockResolvedValue(undefined);
    const down = vi.fn().mockResolvedValue(undefined);
    const up = vi.fn().mockResolvedValue(undefined);
    const page = { $, mouse: { move, down, up } } as unknown as Page;

    const p = dragAndDrop(page, "#src", "#tgt", { steps: 5 });
    await vi.runAllTimersAsync();
    await p;

    // first move is to the source centre, before mouse down
    expect(move).toHaveBeenNthCalledWith(1, 50, 50);
    expect(down).toHaveBeenCalledTimes(1);
    // humanMouseMove adds `steps` interpolated moves ending on the target centre
    expect(move).toHaveBeenLastCalledWith(250, 250);
    expect(move).toHaveBeenCalledTimes(1 + 5);
    expect(up).toHaveBeenCalledTimes(1);
    // ordering: down after the initial move, up last
    expect(down.mock.invocationCallOrder[0]!).toBeGreaterThan(move.mock.invocationCallOrder[0]!);
    expect(up.mock.invocationCallOrder[0]!).toBeGreaterThan(move.mock.invocationCallOrder[5]!);
  });

  it("throws SelectorNotFoundError when the source selector is absent", async () => {
    const page = { $: vi.fn().mockResolvedValue(null), mouse: {} } as unknown as Page;
    const err = await dragAndDrop(page, "#missing", "#tgt").catch((e) => e);
    expect(err.name).toBe("SelectorNotFoundError");
    expect(err.retryable).toBe(false);
  });

  it("throws SelectorNotFoundError when an element has no bounding box", async () => {
    const src = elementWithBox(null);
    const page = { $: vi.fn().mockResolvedValue(src), mouse: {} } as unknown as Page;
    const err = await dragAndDrop(page, "#src", "#tgt").catch((e) => e);
    expect(err.name).toBe("SelectorNotFoundError");
    expect(err.context).toMatchObject({ reason: "element has no bounding box" });
  });
});
