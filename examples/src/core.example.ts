/**
 * @technical-1/core — error hierarchy demo
 *
 * Constructs each error subclass and inspects the base-class contract:
 * .name, .retryable, .context, and the .message shape.
 *
 * Run: pnpm tsx examples/src/core.example.ts
 */

import {
  PptrKitError,
  SelectorNotFoundError,
  NavigationError,
  TimeoutError,
  CaptchaError,
  ProxyError,
  SessionError,
} from "@technical-1/core";

// Base error — retryable defaults to false
const base = new PptrKitError("base error", {
  retryable: true,
  context: { op: "demo" },
});
console.log(base.name, base.retryable, base.context);
// => PptrKitError true { op: 'demo' }

// SelectorNotFoundError — terminal by default, exposes .selector
const sel = new SelectorNotFoundError("#submit");
console.log(sel.name, sel.retryable, sel.selector);
// => SelectorNotFoundError false #submit

// NavigationError — retryable by default, exposes .url
const nav = new NavigationError("https://example.com");
console.log(nav.name, nav.retryable, nav.url);
// => NavigationError true https://example.com

// TimeoutError — retryable by default
const timeout = new TimeoutError("page load timed out");
console.log(timeout.name, timeout.retryable);
// => TimeoutError true

// CaptchaError — terminal by default
const captcha = new CaptchaError("reCAPTCHA v3 challenge");
console.log(captcha.name, captcha.retryable);
// => CaptchaError false

// ProxyError — retryable by default
const proxy = new ProxyError("proxy auth failed");
console.log(proxy.name, proxy.retryable);
// => ProxyError true

// SessionError — terminal by default
const session = new SessionError("session restore failed");
console.log(session.name, session.retryable);
// => SessionError false

// instanceof chain is sound
console.log(sel instanceof PptrKitError, nav instanceof PptrKitError);
// => true true
