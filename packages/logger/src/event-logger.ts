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
  constructor() {
    super();
    // This logger exists to fan one stream out to many subscribers (e.g. an
    // Electron UI bridge plus diagnostics). Disable Node's default
    // maxListeners=10 warning — listener count is the host's concern.
    this.setMaxListeners(0);
  }

  log(message: string, level: LogLevel = "info"): void {
    const event: LogEvent = { message, level };
    this.emit("log", event);
  }
}

export function createEventLogger(): EventLogger {
  return new EventLogger();
}
