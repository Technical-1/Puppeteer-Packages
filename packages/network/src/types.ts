import type { ResourceType } from "puppeteer-core";

/** A request-blocking pattern. */
export type BlockPattern = ResourceType | RegExp;

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
   * Lazily fetch the raw response body. Opt-in: only enabled when this
   * response's `resourceType` matched the `body` gate passed to
   * `captureResponses`; otherwise throws a terminal `PptrKitError`. Must be
   * awaited before the page navigates away (puppeteer discards the body
   * afterwards). Result is cached after the first successful pull.
   */
  buffer(): Promise<Uint8Array>;
  /** UTF-8 decode of `buffer()`. Same opt-in / caching rules. */
  text(): Promise<string>;
  /** `JSON.parse(text())`. Throws a terminal `PptrKitError` on malformed JSON. */
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
