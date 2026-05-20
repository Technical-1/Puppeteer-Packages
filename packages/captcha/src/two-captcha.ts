import { CaptchaError } from "@technical-1/core";
import type { CaptchaSolver, TwoCaptchaOptions } from "./types.js";

/**
 * Test-only options. Includes the injectable `fetch` seam. NOT exported
 * from the barrel — tests import `createTwoCaptchaAdapterForTesting`
 * directly from this file.
 */
export interface InternalTwoCaptchaOptions extends TwoCaptchaOptions {
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_POLL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Construct a 2captcha-backed `CaptchaSolver`. The `apiKey` is required;
 * NEVER log or echo it back to callers. The adapter holds no state beyond
 * the closure-captured key and options.
 */
export function createTwoCaptchaAdapter(
  apiKey: string,
  opts: TwoCaptchaOptions = {},
): CaptchaSolver {
  return createTwoCaptchaAdapterForTesting(apiKey, opts);
}

/**
 * Internal factory accepting the wider `InternalTwoCaptchaOptions` (incl. an
 * injectable `fetch`). NOT re-exported by the barrel. Production consumers
 * should call `createTwoCaptchaAdapter` instead.
 *
 * @internal
 */
export function createTwoCaptchaAdapterForTesting(
  apiKey: string,
  opts: InternalTwoCaptchaOptions = {},
): CaptchaSolver {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetch ?? globalThis.fetch;

  async function solve(method: string, sitekey: string, pageUrl: string, sitekeyParam: "googlekey" | "sitekey"): Promise<string> {
    // Step 1: submit the captcha. 2captcha's in.php returns "OK|<id>" or "ERROR_<code>".
    const inUrl = `https://2captcha.com/in.php?key=${encodeURIComponent(apiKey)}&method=${method}&${sitekeyParam}=${encodeURIComponent(sitekey)}&pageurl=${encodeURIComponent(pageUrl)}&json=0`;
    const inRes = await fetchImpl(inUrl);
    const inText = (await inRes.text()).trim();
    if (!inText.startsWith("OK|")) {
      // Do NOT echo apiKey in the error — pass only the upstream code.
      throw new CaptchaError(`2captcha submit failed: ${inText}`, {
        retryable: false,
        context: { method, upstream: inText },
      });
    }
    const requestId = inText.slice(3);

    // Step 2: poll res.php until "OK|<token>" or "ERROR_<code>" or our own timeout.
    const deadline = Date.now() + timeoutMs;
    const resUrl = `https://2captcha.com/res.php?key=${encodeURIComponent(apiKey)}&action=get&id=${encodeURIComponent(requestId)}&json=0`;
    while (Date.now() < deadline) {
      await sleep(pollMs);
      const pollRes = await fetchImpl(resUrl);
      const pollText = (await pollRes.text()).trim();
      if (pollText === "CAPCHA_NOT_READY") continue;
      if (pollText.startsWith("OK|")) return pollText.slice(3);
      // Any other response is a terminal error from upstream.
      throw new CaptchaError(`2captcha poll failed: ${pollText}`, {
        retryable: false,
        context: { method, upstream: pollText, requestId },
      });
    }
    throw new CaptchaError(`2captcha timed out after ${timeoutMs}ms`, {
      retryable: false,
      context: { method, requestId, timeoutMs },
    });
  }

  return {
    solveRecaptchaV2: (sitekey, pageUrl) => solve("userrecaptcha", sitekey, pageUrl, "googlekey"),
    solveHCaptcha: (sitekey, pageUrl) => solve("hcaptcha", sitekey, pageUrl, "sitekey"),
    solveTurnstile: (sitekey, pageUrl) => solve("turnstile", sitekey, pageUrl, "sitekey"),
  };
}
