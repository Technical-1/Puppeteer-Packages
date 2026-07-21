import { PptrKitError, ConfigError } from "@technical-1/core";
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

/** Depth-first pre-order collect of every node satisfying `predicate`. */
function collect(
  tree: SerializedAXNode | null,
  predicate: (node: SerializedAXNode) => boolean,
): SerializedAXNode[] {
  if (tree === null) return [];
  const out: SerializedAXNode[] = [];
  const walk = (node: SerializedAXNode): void => {
    if (predicate(node)) out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return out;
}

/**
 * Find every AX node whose `role` exactly equals `role`, searched depth-first
 * pre-order from `tree` (which may be `null` — the return is then `[]`). Throws
 * `ConfigError` (`retryable:false`) for an empty or whitespace-only `role`.
 */
export function findByRole(tree: SerializedAXNode | null, role: string): SerializedAXNode[] {
  if (role.trim() === "") {
    throw new ConfigError("findByRole: role must be a non-empty string");
  }
  return collect(tree, (node) => node.role === role);
}

/**
 * Find every AX node whose accessible `name` exactly equals `name`, searched
 * depth-first pre-order from `tree` (which may be `null` — the return is then `[]`).
 * Name-less nodes never match. Throws `ConfigError` (`retryable:false`) for an empty
 * or whitespace-only `name`.
 */
export function findByName(tree: SerializedAXNode | null, name: string): SerializedAXNode[] {
  if (name.trim() === "") {
    throw new ConfigError("findByName: name must be a non-empty string");
  }
  return collect(tree, (node) => node.name === name);
}
