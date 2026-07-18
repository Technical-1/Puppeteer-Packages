import type { Page, ElementHandle } from "puppeteer-core";
import { SelectorNotFoundError, TimeoutError } from "@technical-1/core";
import type { InteractionOptions, PageOrFrame } from "./helpers.js";
import { DEFAULT_TIMEOUT } from "./helpers.js";

/** Structural view of the file-input method (avoids depending on the DOM lib). */
type UploadCapable = { uploadFile(...paths: string[]): Promise<void> };

/**
 * Set files on a plain `<input type=file>` (works inside a Frame). The input is
 * waited for by presence only — file inputs are frequently hidden — and a miss
 * throws a terminal `SelectorNotFoundError`.
 */
export async function uploadFile(
  target: PageOrFrame,
  selector: string,
  files: string | string[],
  opts: InteractionOptions = {},
): Promise<void> {
  const list = Array.isArray(files) ? files : [files];
  let handle: ElementHandle | null;
  try {
    handle = await target.waitForSelector(selector, {
      timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    });
  } catch (err) {
    throw new SelectorNotFoundError(selector, { cause: err });
  }
  if (!handle) throw new SelectorNotFoundError(selector);
  opts.logger?.log(`upload ${selector}`, "step");
  await (handle as unknown as UploadCapable).uploadFile(...list);
}

/**
 * Upload via a styled button backed by the native file chooser. Waits for the
 * visible trigger, races `waitForFileChooser` against the click, then accepts
 * the files. A chooser that never opens surfaces as a retryable `TimeoutError`.
 */
export async function uploadViaFileChooser(
  page: Page,
  triggerSelector: string,
  files: string | string[],
  opts: InteractionOptions = {},
): Promise<void> {
  const list = Array.isArray(files) ? files : [files];
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;

  let trigger: ElementHandle | null;
  try {
    trigger = await page.waitForSelector(triggerSelector, {
      visible: true,
      timeout,
    });
  } catch (err) {
    throw new SelectorNotFoundError(triggerSelector, { cause: err });
  }
  if (!trigger) throw new SelectorNotFoundError(triggerSelector);

  let chooser;
  try {
    const [c] = await Promise.all([
      page.waitForFileChooser({ timeout }),
      page.click(triggerSelector),
    ]);
    chooser = c;
  } catch (err) {
    throw new TimeoutError(
      `file chooser did not open for ${triggerSelector}`,
      { cause: err, context: { selector: triggerSelector, timeout } },
    );
  }

  opts.logger?.log(`upload via chooser ${triggerSelector}`, "step");
  await chooser.accept(list);
}
