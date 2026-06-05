# @technical-1/proxy

Proxy helpers: build the Chrome `--proxy-server` launch arg, apply
authenticated-proxy credentials to a `Page`, and round-robin a proxy pool.
Invalid input throws a `@technical-1/core` `ProxyError`.

> **Convenience wrapper.** This package wraps Chrome's `--proxy-server` launch arg string, puppeteer-core's `page.authenticate()`, and a small round-robin array into a typed, validated interface. It doesn't provide proxy infrastructure or advanced rotation logic — it exists so the rest of `@technical-1/*` handles proxy config through one consistent surface with typed errors (`ProxyError`). If you only need proxy support, you can pass `--proxy-server` directly and call `page.authenticate()` yourself.

```ts
import { proxyArg, applyProxyAuth, ProxyRotator } from "@technical-1/proxy";

const args = [proxyArg("http://1.2.3.4:8080")];
await applyProxyAuth(page, { username: "u", password: "p" });
const rotator = new ProxyRotator(["http://a:1", "http://b:2"]);
rotator.next();
```
