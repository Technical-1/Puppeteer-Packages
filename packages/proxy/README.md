# @technical-1/proxy

Proxy helpers: build the Chrome `--proxy-server` launch arg, apply
authenticated-proxy credentials to a `Page`, and round-robin a proxy pool.
Invalid input throws a `@technical-1/core` `ProxyError`.

```ts
import { proxyArg, applyProxyAuth, ProxyRotator } from "@technical-1/proxy";

const args = [proxyArg("http://1.2.3.4:8080")];
await applyProxyAuth(page, { username: "u", password: "p" });
const rotator = new ProxyRotator(["http://a:1", "http://b:2"]);
rotator.next();
```
