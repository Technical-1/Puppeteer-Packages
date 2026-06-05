/**
 * @technical-1/logger — console + event logger demo
 *
 * Shows createConsoleLogger (filtered by minLevel) and createEventLogger
 * (fan-out via EventEmitter "log" event). Demonstrates the LogEvent shape.
 *
 * Run: pnpm tsx examples/src/logger.example.ts
 */

import {
  createConsoleLogger,
  createEventLogger,
} from "@technical-1/logger";
import type { LogEvent } from "@technical-1/logger";

// ── Console logger ────────────────────────────────────────────────────────────
// minLevel: "warn" → "debug" and "info" messages are dropped.
const filteredLogger = createConsoleLogger({ minLevel: "warn" });

filteredLogger.log("debug detail", "debug");   // suppressed
filteredLogger.log("routine info", "info");    // suppressed
filteredLogger.log("step started", "step");    // suppressed
filteredLogger.log("something succeeded", "success"); // suppressed
filteredLogger.log("watch out", "warn");       // printed via console.warn
filteredLogger.log("hard failure", "error");   // printed via console.error

// Default minLevel is "debug" — all levels pass through.
const verbose = createConsoleLogger();
verbose.log("verbose debug message", "debug");

// ── Event logger ─────────────────────────────────────────────────────────────
// Collects entries in memory so we can assert on them in a typecheck-only file.
const collected: LogEvent[] = [];

const events = createEventLogger();
events.on("log", (entry: LogEvent) => {
  collected.push(entry);
});

events.log("starting scrape", "step");
events.log("page loaded", "info");
events.log("unexpected status 429", "warn");

console.log("event entries collected:", collected.length);
// => event entries collected: 3
console.log("first entry:", collected[0]);
// => first entry: { message: 'starting scrape', level: 'step' }

// Multiple subscribers (no maxListeners warning — setMaxListeners(0))
events.on("log", (_e: LogEvent) => { /* second subscriber — no-op */ });
events.log("second subscriber test", "debug");
console.log("total after second sub:", collected.length);
// => total after second sub: 4 — second subscriber is a no-op; both fire, only the first pushes
