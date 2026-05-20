# @technical-1/captcha

Captcha-solver adapter interface plus a reference 2captcha adapter. The
consumer supplies the API key — **no credentials bundled in this package**.

```ts
import { createTwoCaptchaAdapter, injectToken } from "@technical-1/captcha";

const solver = createTwoCaptchaAdapter(process.env.TWOCAPTCHA_API_KEY!);
const token = await solver.solveRecaptchaV2("SITE_KEY", page.url());
await injectToken(page, "#g-recaptcha-response", token);
```

## Adapter interface

```ts
interface CaptchaSolver {
  solveRecaptchaV2(sitekey: string, pageUrl: string): Promise<string>;
  solveHCaptcha(sitekey: string, pageUrl: string): Promise<string>;
  solveTurnstile(sitekey: string, pageUrl: string): Promise<string>;
}
```

Other providers (anti-captcha, capmonster) slot in via the same shape.

## v1 limitations

- Reference adapter is 2captcha only. v2 ships additional adapters that
  implement the same `CaptchaSolver` interface — no consumer change required.
- Three captcha types covered: reCAPTCHA v2, hCaptcha, Cloudflare Turnstile.
  reCAPTCHA v3 / image / FunCaptcha are v2.
- `injectToken` writes the solution token into the matched element's
  `innerText` (works for the standard hidden-textarea pattern). Pages with
  custom callback wiring may need additional `evaluate` to fire the callback.

## Errors

Throws `CaptchaError` from `@technical-1/core` (terminal — `retryable:false`)
on solver failures, with the underlying HTTP response or `cause` attached.

## Security

The 2captcha API key is sensitive. Pass it via `config` (or env var) and
never log it. This package does not log the key.

## Peer

Requires `puppeteer-core` `>=22 <25` (for `injectToken` only — the solver
adapter itself has no runtime puppeteer dependency).
