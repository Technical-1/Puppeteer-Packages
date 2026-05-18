import type { Logger } from "./logger.js";

/** Mixed into option objects for packages that emit log lines. */
export interface LoggerOption {
  logger?: Logger;
}

/** Mixed into option objects for time-bounded operations (milliseconds). */
export interface TimeoutOption {
  timeout?: number;
}
