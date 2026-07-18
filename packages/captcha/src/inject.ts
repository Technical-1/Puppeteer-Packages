import { CaptchaError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

// In-page globals referenced inside the evaluate callback. Module-scoped
// declarations keep the package Node-only (no DOM lib) per the cemented
// convention.
interface InPageElement {
  tagName?: string;
  value?: string;
  innerText?: string;
  dispatchEvent(evt: unknown): boolean;
}
declare var document: { querySelector(s: string): InPageElement | null };
declare var Event: { new (type: string, init?: { bubbles?: boolean }): unknown };

/**
 * Inject a solved-captcha token into the element matching `selector`. For
 * `<input>`/`<textarea>` fields (the elements that actually submit) this sets
 * `.value` and dispatches `input`+`change` events so framework listeners
 * observe it; for other elements it falls back to setting `innerText`. This
 * covers both the standard hidden-textarea pattern (e.g.
 * `#g-recaptcha-response`) and Cloudflare Turnstile's hidden
 * `<input name="cf-turnstile-response">`.
 *
 * Throws `CaptchaError` (`retryable:false`):
 *   - if the selector does not match an element (programmer error)
 *   - if `page.evaluate` itself fails (page-state error)
 *
 * Note: some pages have custom callback wiring that must fire after the
 * token lands. This v1 helper does NOT call any `window[callback]` — call
 * `page.evaluate(...)` yourself afterward if needed. v2 may add an optional
 * `callbackName` arg.
 */
export async function injectToken(
  page: Page,
  selector: string,
  token: string,
): Promise<void> {
  let landed: boolean;
  try {
    landed = await page.evaluate(
      (sel: string, tok: string): boolean => {
        const el = document.querySelector(sel);
        if (el === null) return false;
        const tag = el.tagName ? el.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea") {
          // Form fields submit their .value, not their text content. Set
          // value and fire input+change so framework listeners (React/Vue)
          // observe it.
          el.value = tok;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          el.innerText = tok;
        }
        return true;
      },
      selector,
      token,
    );
  } catch (cause) {
    throw new CaptchaError(`injectToken: page.evaluate failed (selector: ${selector})`, {
      retryable: false,
      cause,
      context: { selector },
    });
  }
  if (landed === false) {
    throw new CaptchaError(`injectToken: selector did not match any element: ${selector}`, {
      retryable: false,
      context: { selector },
    });
  }
}
