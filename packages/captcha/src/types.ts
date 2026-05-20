/** A single captcha challenge type the v1 adapter handles. */
export type CaptchaType = "recaptcha-v2" | "hcaptcha" | "turnstile";

/**
 * The provider-agnostic solver interface. v1 ships a 2captcha reference
 * implementation; other providers (anti-captcha, capmonster) slot in via
 * the same shape.
 */
export interface CaptchaSolver {
  /** Solve a Google reCAPTCHA v2 challenge. Returns the token string. */
  solveRecaptchaV2(sitekey: string, pageUrl: string): Promise<string>;
  /** Solve an hCaptcha challenge. Returns the token string. */
  solveHCaptcha(sitekey: string, pageUrl: string): Promise<string>;
  /** Solve a Cloudflare Turnstile challenge. Returns the token string. */
  solveTurnstile(sitekey: string, pageUrl: string): Promise<string>;
}

/** Construction options for the 2captcha adapter. */
export interface TwoCaptchaOptions {
  /**
   * Polling interval against 2captcha's `res.php` endpoint while waiting
   * for a solution. Default 5000ms (matches 2captcha's recommended cadence).
   */
  pollMs?: number;
  /**
   * Overall solver timeout. Default 120000ms (2 minutes). 2captcha typically
   * returns within 30-60s but slow days happen.
   */
  timeoutMs?: number;
}
