import type { ResourceType } from "puppeteer-core";

/** A request-blocking pattern. */
export type BlockPattern = ResourceType | RegExp;

/** One hop in a redirect chain leading to a final response. */
export interface RedirectHop {
  /** The URL that issued the redirect. */
  url: string;
  /** HTTP method of the redirect request. */
  method: string;
  /** Status of the redirect hop (e.g. 301/302), or `null` if it had no response. */
  status: number | null;
}

/** A single captured response. Body access is lazy and opt-in. */
export interface ResponseRecord {
  url: string;
  status: number;
  method: string;
  resourceType: ResourceType;
  /** Response headers (lower-cased keys per puppeteer-core). Captured eagerly. */
  headers: Record<string, string>;
  /** Whether the response was served from the browser cache. Captured eagerly. */
  fromCache: boolean;
  /** `Date.now()` at the moment puppeteer fired the response event. */
  timestamp: number;
  /**
   * Redirect hops that preceded this response, oldest→newest (empty when the
   * request was not redirected). Reconstructed eagerly from
   * `response.request().redirectChain()`; the final hop is THIS record itself
   * (its own `url`/`status`).
   */
  redirects: readonly RedirectHop[];
  /**
   * Lazily fetch the raw response body. Opt-in: only enabled when this
   * response's `resourceType` matched the `body` gate passed to
   * `captureResponses`; otherwise throws a terminal `NetworkError`. Must be
   * awaited before the page navigates away (puppeteer discards the body
   * afterwards). Result is cached after the first successful pull.
   */
  buffer(): Promise<Uint8Array>;
  /** UTF-8 decode of `buffer()`. Same opt-in / caching rules. */
  text(): Promise<string>;
  /** `JSON.parse(text())`. Throws a terminal `NetworkError` on malformed JSON. */
  json(): Promise<unknown>;
}

/** Handle returned by `captureResponses`. */
export interface ResponseCollector {
  /** A live, read-only snapshot, updated as responses arrive. */
  readonly responses: ReadonlyArray<ResponseRecord>;
  /** Unsubscribe from page response events. Idempotent. */
  stop(): void;
}

/** Network throttle profile (Chrome DevTools Protocol shape). */
export interface ThrottleProfile {
  /** `true` to simulate offline (overrides throughput/latency). */
  offline: boolean;
  /** Download throughput in bytes/sec. `-1` disables download throttling. */
  downloadThroughput: number;
  /** Upload throughput in bytes/sec. `-1` disables upload throttling. */
  uploadThroughput: number;
  /** Round-trip latency in milliseconds. */
  latency: number;
}
