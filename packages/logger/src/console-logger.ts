import { LOG_LEVELS, type Logger, type LogLevel } from "@technical-1/core";

export interface ConsoleLoggerOptions {
  /** Drop messages whose level is below this. Default "debug" (keep all). */
  minLevel?: LogLevel;
}

const RANK: Record<LogLevel, number> = Object.fromEntries(
  LOG_LEVELS.map((l, i) => [l, i]),
) as Record<LogLevel, number>;

function methodFor(level: LogLevel): "debug" | "info" | "warn" | "error" {
  if (level === "debug") return "debug";
  if (level === "warn") return "warn";
  if (level === "error") return "error";
  return "info"; // info, step, success
}

/** A Logger that writes to the matching console method, filtered by minLevel. */
export function createConsoleLogger(opts: ConsoleLoggerOptions = {}): Logger {
  const min = RANK[opts.minLevel ?? "debug"];
  return {
    log(message: string, level: LogLevel = "info"): void {
      if (RANK[level] < min) return;
      console[methodFor(level)](message);
    },
  };
}
