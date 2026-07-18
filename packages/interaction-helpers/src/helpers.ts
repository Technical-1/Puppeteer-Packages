import type { Page, Frame } from "puppeteer-core";
import { SelectorNotFoundError } from "@technical-1/core";
import type { LoggerOption, TimeoutOption } from "@technical-1/core";

// Minimal browser-global declarations for in-page evaluate callbacks.
// These are NOT part of the Node.js lib; they run inside Chromium.
// We declare only what we actually use to avoid importing the full DOM lib.
declare var document: {
  querySelector(s: string): { textContent: string | null } | null;
  body: { scrollHeight: number };
};
declare var window: {
  scrollBy(x: number, y: number): void;
  scrollTo(x: number, y: number): void;
};

/** A puppeteer-core `Page` or `Frame` — the helpers work against either. */
export type PageOrFrame = Page | Frame;

export const DEFAULT_TIMEOUT = 15000;

export interface InteractionOptions extends LoggerOption, TimeoutOption {}

async function waitVisible(
  page: PageOrFrame,
  selector: string,
  timeout: number,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
  } catch (err) {
    throw new SelectorNotFoundError(selector, { cause: err });
  }
}

/** Wait for a visible selector, then click it. */
export async function safeClick(
  page: PageOrFrame,
  selector: string,
  opts: InteractionOptions = {},
): Promise<void> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  opts.logger?.log(`click ${selector}`, "step");
  await page.click(selector);
}

export interface TypeOptions extends InteractionOptions {
  /** Per-keystroke delay in ms. Default 0. */
  delay?: number;
}

/** Wait for a visible selector, then type text into it. */
export async function safeType(
  page: PageOrFrame,
  selector: string,
  text: string,
  opts: TypeOptions = {},
): Promise<void> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  opts.logger?.log(`type into ${selector}`, "step");
  await page.type(selector, text, { delay: opts.delay ?? 0 });
}

/**
 * Wait for a visible selector, return its trimmed textContent. Presence is
 * already guaranteed by the visibility wait — a `""` result means the element
 * exists but has no text, NOT that it is absent (don't use the return value
 * for presence checks).
 */
export async function waitAndGet(
  page: PageOrFrame,
  selector: string,
  opts: InteractionOptions = {},
): Promise<string> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  const text = await page.evaluate((sel: string) => {
    /* v8 ignore next 2 -- runs in-browser inside Chromium; covered by the integration tier */
    const el = document.querySelector(sel);
    return el ? el.textContent : "";
  }, selector);
  return (text ?? "").trim();
}

export interface ScrollOptions extends LoggerOption {
  /** If given, scroll by this many pixels; otherwise jump to the bottom. */
  by?: number;
}

/** Scroll the page or frame. Default: jump to the bottom (triggers lazy content). */
export async function scroll(
  page: PageOrFrame,
  opts: ScrollOptions = {},
): Promise<void> {
  opts.logger?.log(
    opts.by !== undefined ? `scroll by ${opts.by}` : "scroll to bottom",
    "step",
  );
  await page.evaluate((by?: number) => {
    /* v8 ignore next 2 -- runs in-browser inside Chromium; covered by the integration tier */
    if (typeof by === "number") window.scrollBy(0, by);
    else window.scrollTo(0, document.body.scrollHeight);
  }, opts.by);
}
