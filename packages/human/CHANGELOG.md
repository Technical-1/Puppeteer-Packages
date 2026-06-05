# @technical-1/human

## 0.1.1

### Patch Changes

- 6ecf5eb: Clarify in each README that these are convenience wrappers — they add the suite's typed errors / injected logger / sane defaults for consistency, not new capability beyond the underlying puppeteer-core API or plugin.

## 0.1.0

### Minor Changes

- b8a179c: Anti-detection tier: `stealth` (puppeteer-extra-plugin-stealth wrapper;
  `puppeteer-extra` is a real dependency), `fingerprint`
  (`randomFingerprint`/`applyFingerprint`), `human` (`humanDelay`/`humanType`/
  `humanMouseMove`), and `proxy` (`proxyArg`/`applyProxyAuth`/`ProxyRotator`,
  throwing `core` `ProxyError`). `fingerprint`/`human`/`proxy` declare
  `puppeteer-core` as a peer; `stealth` is standalone (no `puppeteer-core` peer;
  the consumer passes their puppeteer instance). `fingerprint`/`human` are
  standalone (no `@technical-1/core` dep); `proxy` depends on core for `ProxyError`.
