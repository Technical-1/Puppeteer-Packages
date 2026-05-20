---
"@technical-1/stealth": minor
"@technical-1/fingerprint": minor
"@technical-1/human": minor
"@technical-1/proxy": minor
---

Anti-detection tier: `stealth` (puppeteer-extra-plugin-stealth wrapper;
`puppeteer-extra` is a real dependency), `fingerprint`
(`randomFingerprint`/`applyFingerprint`), `human` (`humanDelay`/`humanType`/
`humanMouseMove`), and `proxy` (`proxyArg`/`applyProxyAuth`/`ProxyRotator`,
throwing `core` `ProxyError`). `fingerprint`/`human`/`proxy` declare
`puppeteer-core` as a peer; `stealth` is standalone (no `puppeteer-core` peer;
the consumer passes their puppeteer instance). `fingerprint`/`human` are
standalone (no `@technical-1/core` dep); `proxy` depends on core for `ProxyError`.
