import { ProxyError } from "@technical-1/core";
import type { Page } from "puppeteer-core";

/** Build the Chrome `--proxy-server=<url>` launch arg. Throws on blank input. */
export function proxyArg(url: string): string {
  if (url.trim() === "") {
    throw new ProxyError("Proxy URL must be a non-empty string", {
      retryable: false,
      context: { url },
    });
  }
  return `--proxy-server=${url}`;
}

export interface ProxyCredentials {
  username: string;
  password: string;
}

/**
 * Apply authenticated-proxy credentials to a page. To CLEAR credentials, call
 * `page.authenticate(null)` directly (this helper only sets, not clears).
 */
export async function applyProxyAuth(
  page: Page,
  credentials: ProxyCredentials,
): Promise<void> {
  await page.authenticate(credentials);
}

/** Round-robin rotator over a non-empty proxy pool. */
export class ProxyRotator {
  readonly #pool: readonly string[];
  #idx = 0;

  constructor(pool: readonly string[]) {
    if (pool.length === 0) {
      throw new ProxyError("ProxyRotator requires a non-empty pool", {
        retryable: false,
        context: { size: 0 },
      });
    }
    this.#pool = [...pool];
  }

  /** Return the next proxy, cycling back to the start. */
  next(): string {
    const proxy = this.#pool[this.#idx] as string;
    this.#idx = (this.#idx + 1) % this.#pool.length;
    return proxy;
  }
}
