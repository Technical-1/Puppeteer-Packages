export type ErrorContext = Record<string, unknown>;

export interface PptrKitErrorOptions {
  retryable?: boolean;
  context?: ErrorContext;
  cause?: unknown;
}

/** Base error for the @technical-1 suite. */
export class PptrKitError extends Error {
  readonly retryable: boolean;
  readonly context: ErrorContext;

  constructor(message: string, opts: PptrKitErrorOptions = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.retryable = opts.retryable ?? false;
    this.context = opts.context ?? {};
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A selector never appeared / matched. Terminal by default. */
export class SelectorNotFoundError extends PptrKitError {
  readonly selector: string;
  constructor(selector: string, opts: PptrKitErrorOptions = {}) {
    super(`Selector not found: ${selector}`, { retryable: false, ...opts });
    this.selector = selector;
  }
}

/** Navigation to a URL failed. Retryable by default. */
export class NavigationError extends PptrKitError {
  readonly url: string;
  constructor(url: string, opts: PptrKitErrorOptions = {}) {
    super(`Navigation failed: ${url}`, { retryable: true, ...opts });
    this.url = url;
  }
}

/** An operation exceeded its time budget. Retryable by default. */
export class TimeoutError extends PptrKitError {
  constructor(message: string, opts: PptrKitErrorOptions = {}) {
    super(message, { retryable: true, ...opts });
  }
}

/** A captcha / anti-bot challenge was encountered. Terminal by default. */
export class CaptchaError extends PptrKitError {
  constructor(message: string, opts: PptrKitErrorOptions = {}) {
    super(message, { retryable: false, ...opts });
  }
}

/** A proxy connection / auth failure. Retryable by default. */
export class ProxyError extends PptrKitError {
  constructor(message: string, opts: PptrKitErrorOptions = {}) {
    super(message, { retryable: true, ...opts });
  }
}

/** Session persist/restore failure. Terminal by default. */
export class SessionError extends PptrKitError {
  constructor(message: string, opts: PptrKitErrorOptions = {}) {
    super(message, { retryable: false, ...opts });
  }
}
