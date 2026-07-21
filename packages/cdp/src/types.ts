import type { CDPEvents, CDPSession, Page, Target } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";

/** Anything that can open a CDP session. */
export type CdpSource = Page | Target;

export interface OpenCdpSessionOptions extends LoggerOption {}

/** Thin, error-wrapped handle over a puppeteer-core CDPSession. */
export interface CdpSession {
  /** The underlying puppeteer-core session (escape hatch). */
  readonly raw: CDPSession;
  /** Whether detach() has been called through this handle. */
  readonly detached: boolean;
  /** Send a typed CDP command; wraps failures as CdpError (retryable:true). */
  send: CDPSession["send"];
  /** Subscribe to a CDP event; returns an idempotent unsubscribe disposer. */
  on<K extends keyof CDPEvents>(
    event: K,
    handler: (payload: CDPEvents[K]) => void,
  ): () => void;
  /** Detach the session. Idempotent; wraps failures as CdpError (retryable:false). */
  detach(): Promise<void>;
}
