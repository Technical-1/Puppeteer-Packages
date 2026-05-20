import { CaptchaError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

// In-page globals referenced inside the evaluate callback. Module-scoped
// declarations keep the package Node-only (no DOM lib) per the cemented
// convention.
declare var document: { querySelector(s: string): { innerText: string } | null };

/**
 * Inject a solved-captcha token into the element matching `selector` by
 * setting its `innerText`. Works for the standard hidden-textarea pattern
 * (e.g. `#g-recaptcha-response`, `[name="cf-turnstile-response"]`).
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
        el.innerText = tok;
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
