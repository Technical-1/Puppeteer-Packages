import { PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type { Page, SerializedAXNode, SnapshotOptions } from "puppeteer-core";

/** A serialized accessibility-tree node, re-exported so consumers needn't import puppeteer-core. */
export type AXNode = SerializedAXNode;

/** Options for {@link snapshotAccessibility}: the DI logger plus puppeteer's SnapshotOptions. */
export interface SnapshotAccessibilityOptions extends LoggerOption, SnapshotOptions {}

/**
 * Capture the current accessibility (AX) tree of `page` via
 * `page.accessibility.snapshot()`. Returns the root `SerializedAXNode`, or `null`
 * when the page has no interesting AX content (puppeteer returns `null`).
 *
 * `interestingOnly` (default `true`), `includeIframes` (default `false`), and `root`
 * pass straight through to puppeteer-core. A snapshot rejection is wrapped as a
 * `PptrKitError` (`retryable:true`) carrying the original as `cause`.
 */
export async function snapshotAccessibility(
  page: Page,
  options: SnapshotAccessibilityOptions = {},
): Promise<SerializedAXNode | null> {
  const { logger, ...snapshotOptions } = options;
  logger?.log("capturing accessibility snapshot", "step");
  try {
    const tree = await page.accessibility.snapshot(snapshotOptions);
    logger?.log("captured accessibility snapshot", "success");
    return tree;
  } catch (cause) {
    throw new PptrKitError("snapshotAccessibility: page.accessibility.snapshot failed", {
      retryable: true,
      cause,
    });
  }
}
