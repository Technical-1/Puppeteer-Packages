import { describe, it, expect, vi } from "vitest";
import { snapshotAccessibility } from "./a11y.js";
import { PptrKitError } from "@technical-1/core";
import type { Page, SerializedAXNode } from "puppeteer-core";

/** Build a mock Page whose accessibility.snapshot resolves to `tree`. */
function mockPage(
  tree: SerializedAXNode | null = null,
  overrides: Record<string, unknown> = {},
): { page: Page; snapshot: ReturnType<typeof vi.fn> } {
  const snapshot = vi.fn().mockResolvedValue(tree);
  const page = { accessibility: { snapshot }, ...overrides } as unknown as Page;
  return { page, snapshot };
}

/** Cast helper — SerializedAXNode requires loaderId + elementHandle() we don't set. */
function ax(node: Partial<SerializedAXNode>): SerializedAXNode {
  return node as unknown as SerializedAXNode;
}

describe("snapshotAccessibility — delegation", () => {
  it("returns the tree from page.accessibility.snapshot", async () => {
    const tree = ax({ role: "RootWebArea", name: "Home", children: [] });
    const { page, snapshot } = mockPage(tree);
    const result = await snapshotAccessibility(page);
    expect(result).toBe(tree);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("returns null when the snapshot is null", async () => {
    const { page } = mockPage(null);
    await expect(snapshotAccessibility(page)).resolves.toBeNull();
  });

  it("forwards SnapshotOptions (interestingOnly/includeIframes) and NOT the logger", async () => {
    const { page, snapshot } = mockPage(ax({ role: "RootWebArea" }));
    const logger = { log: vi.fn() };
    await snapshotAccessibility(page, {
      interestingOnly: false,
      includeIframes: true,
      logger,
    });
    expect(snapshot).toHaveBeenCalledWith({ interestingOnly: false, includeIframes: true });
  });

  it("calls snapshot with an empty options object when none supplied", async () => {
    const { page, snapshot } = mockPage(ax({ role: "RootWebArea" }));
    await snapshotAccessibility(page);
    expect(snapshot).toHaveBeenCalledWith({});
  });

  it("emits DI logger step/success lines", async () => {
    const { page } = mockPage(ax({ role: "RootWebArea" }));
    const logger = { log: vi.fn() };
    await snapshotAccessibility(page, { logger });
    expect(logger.log).toHaveBeenCalledWith("capturing accessibility snapshot", "step");
    expect(logger.log).toHaveBeenCalledWith("captured accessibility snapshot", "success");
  });
});

describe("snapshotAccessibility — error wrapping", () => {
  it("wraps a snapshot() rejection as a retryable PptrKitError with cause", async () => {
    const boom = new Error("Target closed");
    const page = {
      accessibility: { snapshot: vi.fn().mockRejectedValue(boom) },
    } as unknown as Page;
    await expect(snapshotAccessibility(page)).rejects.toMatchObject({
      name: "PptrKitError",
      retryable: true,
      cause: boom,
    });
    const page2 = {
      accessibility: { snapshot: vi.fn().mockRejectedValue(boom) },
    } as unknown as Page;
    await expect(snapshotAccessibility(page2)).rejects.toBeInstanceOf(PptrKitError);
  });
});
