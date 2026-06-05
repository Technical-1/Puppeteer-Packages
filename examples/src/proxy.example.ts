/**
 * @technical-1/proxy — proxyArg / applyProxyAuth / ProxyRotator demo
 *
 * Demonstrates building a Chrome proxy launch arg, applying authenticated
 * proxy credentials to a page, and round-robin rotation over a proxy pool.
 *
 * Injected `Page` pattern for applyProxyAuth — typecheck-only, not executed in CI.
 */

import {
  proxyArg,
  applyProxyAuth,
  ProxyRotator,
} from "@technical-1/proxy";
import type { ProxyCredentials } from "@technical-1/proxy";
import type { Page } from "puppeteer-core";
import { ProxyError } from "@technical-1/core";

// ── proxyArg — build the Chrome launch flag ───────────────────────────────
const arg = proxyArg("http://proxy.example.com:8080");
console.log("proxy arg:", arg);
// => --proxy-server=http://proxy.example.com:8080

// Error path: blank URL throws ProxyError
try {
  proxyArg("   ");
} catch (err) {
  if (err instanceof ProxyError) {
    console.log("blank proxy caught:", err.message);
  }
}

// ── ProxyRotator — round-robin over a pool ────────────────────────────────
const rotator = new ProxyRotator([
  "http://proxy1.example.com:8080",
  "http://proxy2.example.com:8080",
  "http://proxy3.example.com:8080",
]);
console.log("next proxy:", rotator.next()); // proxy1
console.log("next proxy:", rotator.next()); // proxy2
console.log("next proxy:", rotator.next()); // proxy3
console.log("next proxy:", rotator.next()); // wraps back to proxy1

// ── applyProxyAuth — authenticate a page with proxy credentials ───────────
export async function demo(page: Page): Promise<void> {
  const credentials: ProxyCredentials = {
    username: "scraper",
    password: "s3cr3t",
  };
  await applyProxyAuth(page, credentials);
  console.log("proxy auth applied");
}
