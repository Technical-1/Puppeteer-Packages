import { EventEmitter } from "node:events";
import type { Logger, LogLevel } from "@technical-1/core";

export interface LogEvent {
  message: string;
  level: LogLevel;
}

/**
 * A Logger that emits a `"log"` event `{ message, level }` for each call.
 * Lets a host (e.g. an Electron renderer bridge) stream lines to a UI.
 */
export class EventLogger extends EventEmitter implements Logger {
  log(message: string, level: LogLevel = "info"): void {
    const event: LogEvent = { message, level };
    this.emit("log", event);
  }
}

export function createEventLogger(): EventLogger {
  return new EventLogger();
}
