import type { Page } from "puppeteer-core";
import { SelectorNotFoundError } from "@technical-1/core";
import { humanMouseMove } from "./human.js";
import type { MousePoint } from "./human.js";

export interface DragAndDropOptions {
  /** Interpolation steps for the drag move (passed to humanMouseMove). Default 12. */
  steps?: number;
}

/** Resolve a selector to the centre of its bounding box, or throw SelectorNotFoundError. */
async function centreOf(page: Page, selector: string): Promise<MousePoint> {
  const handle = await page.$(selector);
  if (!handle) throw new SelectorNotFoundError(selector);
  const box = await handle.boundingBox();
  if (!box) {
    throw new SelectorNotFoundError(selector, {
      context: { reason: "element has no bounding box" },
    });
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Drag from `sourceSelector` to `targetSelector` with human-like mouse motion:
 * move to the source centre, press, interpolate to the target centre via
 * {@link humanMouseMove}, then release. A missing element (or one with no
 * rendered box) throws a terminal `SelectorNotFoundError`.
 */
export async function dragAndDrop(
  page: Page,
  sourceSelector: string,
  targetSelector: string,
  opts: DragAndDropOptions = {},
): Promise<void> {
  const from = await centreOf(page, sourceSelector);
  const to = await centreOf(page, targetSelector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await humanMouseMove(page, from, to, { steps: opts.steps });
  await page.mouse.up();
}
