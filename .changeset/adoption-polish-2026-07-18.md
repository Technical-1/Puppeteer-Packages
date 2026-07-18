---
"@technical-1/captcha": patch
"@technical-1/chrome-setup": patch
"@technical-1/config": patch
"@technical-1/core": patch
"@technical-1/dialogs": patch
"@technical-1/downloads": patch
"@technical-1/emulation": patch
"@technical-1/extract": patch
"@technical-1/fingerprint": patch
"@technical-1/human": patch
"@technical-1/interaction-helpers": patch
"@technical-1/launcher": patch
"@technical-1/logger": patch
"@technical-1/navigation": patch
"@technical-1/network": patch
"@technical-1/pdf": patch
"@technical-1/proxy": patch
"@technical-1/retry": patch
"@technical-1/screenshots": patch
"@technical-1/session": patch
"@technical-1/stealth": patch
"@technical-1/tabs": patch
---

Declare a supported Node floor (`engines.node >=18`, matching the puppeteer-core
peer) on every package, and polish adoption docs: ESM-only notes on
launcher/navigation/extract, a chrome-setup cross-link in the launcher
quick-start, "TypeScript users only" @types/node wording in
navigation/chrome-setup, and README nit fixes (autoScroll frame support,
uploadFile parameter, network waiters import).
