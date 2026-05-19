import type { Page } from "puppeteer-core";
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

const DEFAULT_TIMEOUT = 15000;

export interface InteractionOptions extends LoggerOption, TimeoutOption {}

async function waitVisible(
  page: Page,
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
  page: Page,
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
  page: Page,
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
  page: Page,
  selector: string,
  opts: InteractionOptions = {},
): Promise<string> {
  await waitVisible(page, selector, opts.timeout ?? DEFAULT_TIMEOUT);
  const text = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    return el ? el.textContent : "";
  }, selector);
  return (text ?? "").trim();
}

export interface ScrollOptions {
  /** If given, scroll by this many pixels; otherwise jump to the bottom. */
  by?: number;
}

/** Scroll the page. Default: jump to the bottom (triggers lazy content). */
export async function scroll(page: Page, opts: ScrollOptions = {}): Promise<void> {
  await page.evaluate((by?: number) => {
    if (typeof by === "number") window.scrollBy(0, by);
    else window.scrollTo(0, document.body.scrollHeight);
  }, opts.by);
}
