/**
 * @technical-1/captcha — createTwoCaptchaAdapter / injectToken demo
 *
 * Demonstrates the provider-agnostic CaptchaSolver interface backed by the
 * 2captcha reference adapter, and injecting the solved token into the page.
 *
 * Injected `Page` pattern — typecheck-only, not executed in CI.
 *
 * Security: the API key is read from the environment variable
 * TWOCAPTCHA_API_KEY and is NEVER logged or echoed anywhere in this file
 * (the adapter itself also never logs the key).
 */

import { createTwoCaptchaAdapter, injectToken } from "@technical-1/captcha";
import type { CaptchaSolver, TwoCaptchaOptions } from "@technical-1/captcha";
import type { Page } from "puppeteer-core";

export async function demo(page: Page): Promise<void> {
  // ── Construct the 2captcha adapter ────────────────────────────────────────
  // The API key comes from the environment — never hard-code a real key.
  // The adapter closes over the key but does not log or surface it.
  const apiKey: string = process.env["TWOCAPTCHA_API_KEY"] ?? "";

  const opts: TwoCaptchaOptions = {
    pollMs: 5_000,     // check 2captcha every 5 s (their recommended cadence)
    timeoutMs: 120_000, // overall solver timeout
  };

  // createTwoCaptchaAdapter returns a CaptchaSolver — any other provider
  // that implements the same interface slots in here with no consumer change.
  const solver: CaptchaSolver = createTwoCaptchaAdapter(apiKey, opts);

  // ── Solve a reCAPTCHA v2 challenge ────────────────────────────────────────
  const siteKey = "6LeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // public sitekey from the target page
  const token = await solver.solveRecaptchaV2(siteKey, page.url());
  console.log("token received (first 20 chars):", token.slice(0, 20) + "…");

  // ── Inject the token into the page ────────────────────────────────────────
  // Writes the token into the element's innerText. Throws CaptchaError
  // (retryable:false) if the selector does not match.
  await injectToken(page, "#g-recaptcha-response", token);
  console.log("token injected into #g-recaptcha-response");

  // ── hCaptcha and Turnstile follow the same pattern ────────────────────────
  const hToken = await solver.solveHCaptcha(siteKey, page.url());
  await injectToken(page, "[name='h-captcha-response']", hToken);

  const tsToken = await solver.solveTurnstile(siteKey, page.url());
  await injectToken(page, "[name='cf-turnstile-response']", tsToken);
  console.log("all captcha types demonstrated");
}
