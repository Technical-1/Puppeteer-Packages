# @technical-1/captcha

## 0.1.0

### Minor Changes

- 0d71ab6: Captcha tier: `createTwoCaptchaAdapter(apiKey, opts?)` reference adapter
  implementing the `CaptchaSolver` interface against 2captcha's HTTP API
  (no SDK dep, no bundled credentials — consumer supplies the apiKey). Plus
  `injectToken(page, selector, token)` for puppeteer-side textarea injection.

  Throws `CaptchaError` from `@technical-1/core` (terminal — `retryable:false`)
  on solver failures, upstream errors, and timeouts. apiKey is never logged
  or echoed; only the upstream error code appears in `CaptchaError.context`.

  Three captcha types supported in v1: reCAPTCHA v2, hCaptcha, Cloudflare
  Turnstile. Other providers (anti-captcha, capmonster) slot in via the
  same `CaptchaSolver` interface — v2 will ship those adapters.

### Patch Changes

- Updated dependencies [1bbfebd]
  - @technical-1/core@0.1.0
