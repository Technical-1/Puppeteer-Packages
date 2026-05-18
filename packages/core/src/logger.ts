/** Log levels, ordered least→most severe. Mirrors the template runner's levels. */
export const LOG_LEVELS = ["debug", "info", "step", "success", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Dependency-injected logging contract. Packages accept an optional `Logger`
 * and never import a concrete implementation. Implementations live in
 * `@technical-1/logger`.
 */
export interface Logger {
  log(message: string, level?: LogLevel): void;
}
