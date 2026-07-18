import type { Page, Frame } from "puppeteer-core";
import { SelectorNotFoundError } from "@technical-1/core";
import type { InteractionOptions } from "./helpers.js";

/** How to locate a frame. Supply exactly one of `selector`, `name`, or `url`. */
export interface FrameQuery {
  /** Match `frame.name()` exactly. */
  name?: string;
  /** Match `frame.url()`: substring (string) or pattern (RegExp). */
  url?: string | RegExp;
  /** CSS selector of the `<iframe>` element; resolved via `ElementHandle.contentFrame()`. */
  selector?: string;
}

/**
 * Resolve a `Frame` in `page` by iframe `selector`, `name`, or `url`. Throws a
 * terminal `SelectorNotFoundError` (carrying a descriptive locator) when no
 * frame matches. `selector` takes precedence, then a `name`/`url` scan of
 * `page.frames()`.
 */
export async function resolveFrame(
  page: Page,
  query: FrameQuery,
  opts: InteractionOptions = {},
): Promise<Frame> {
  if (query.selector !== undefined) {
    const handle = await page.$(query.selector);
    if (!handle) throw new SelectorNotFoundError(query.selector);
    const frame = await handle.contentFrame();
    if (!frame) {
      throw new SelectorNotFoundError(query.selector, {
        context: { reason: "element has no content frame" },
      });
    }
    opts.logger?.log(`frame ${query.selector}`, "step");
    return frame;
  }

  if (query.name === undefined && query.url === undefined) {
    throw new SelectorNotFoundError(
      "frame query requires one of: name, url, selector",
    );
  }

  const match = page.frames().find((f) => {
    if (query.name !== undefined && f.name() !== query.name) return false;
    if (query.url !== undefined) {
      const u = f.url();
      const ok =
        typeof query.url === "string"
          ? u.includes(query.url)
          : query.url.test(u);
      if (!ok) return false;
    }
    return true;
  });

  if (!match) {
    const desc =
      query.name !== undefined
        ? `frame[name=${query.name}]`
        : `frame[url~=${String(query.url)}]`;
    throw new SelectorNotFoundError(desc);
  }

  opts.logger?.log(`frame ${match.name() || match.url()}`, "step");
  return match;
}
