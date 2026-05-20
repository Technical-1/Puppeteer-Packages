import type { ResourceType } from "puppeteer-core";

/** A request-blocking pattern. */
export type BlockPattern = ResourceType | RegExp;

/** A single captured response. */
export interface ResponseRecord {
  url: string;
  status: number;
  method: string;
  resourceType: ResourceType;
  /** `Date.now()` at the moment puppeteer fired the response event. */
  timestamp: number;
}

/** Handle returned by `captureResponses`. */
export interface ResponseCollector {
  /** Caller-readable snapshot. Updated live as responses arrive. */
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
