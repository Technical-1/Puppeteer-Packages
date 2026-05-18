# Utility Tier (`retry`, `logger`, `config`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three core-only utility packages — `@technical-1/retry`
(backoff/retry keyed off the `core` `retryable` contract), `@technical-1/logger`
(console + EventEmitter `Logger` implementations), and `@technical-1/config`
(typed env/options loader) — fully built, tested, and changeset-versioned.

**Architecture:** Each is an independent workspace package depending only on
`@technical-1/core` via `workspace:*` (Changesets rewrites to a real range on
publish). No `puppeteer-core` peer (these are browser-agnostic utilities). Each
follows every Plan 01 convention: canonical per-condition `exports` map, shared
`tsup.config.base.ts` re-export, strict NodeNext + `verbatimModuleSyntax`,
per-package `vitest.config.ts`, `sideEffects:false`, README, ≥1 unit test per
exported function. Function-first APIs (spec §4.4); typed errors from `core`
(spec §4.6).

**Tech Stack:** TypeScript (NodeNext, strict), tsup, vitest (with fake timers
for `retry`), Node built-in `node:events` for the EventEmitter logger.

**Working directory:** `/Users/jacobkanfer/Desktop/Code/Puppeteer-Packages`
(branch `main` at the Plan 01 tip; execution should occur on a fresh
`feat/02-utility-tier` branch — the executor's worktree/branch step handles
this). Authorship is `Jacob Kanfer <kanfer@users.noreply.github.com>` (already
configured; never pass `--author`).

**Invariants (from the roadmap — verify every task):**
- The prohibited work-brand string named in the architecture spec §3 must never
  appear in any file (this plan deliberately avoids the literal token).
- Canonical `exports` map (per-condition dual `types`), copied exactly from the
  roadmap "Conventions" section.
- Every package ships its own minimal `vitest.config.ts`
  (`{ test: { include: ["src/**/*.test.ts"], environment: "node" } }`).
- Error detection is by **property** (`err.retryable`, `err.name`), never
  `instanceof` across package boundaries.
- `@technical-1/logger` owns the documented default-level semantics for
  `Logger.log(message, level?)` when `level` is omitted (default `"info"`).

---

## Reusable building block: the canonical package skeleton

Tasks 1, 4, 7 each scaffold a package with this exact shape (only the name and
description differ). It is repeated in full in each scaffold task — do not
abbreviate when executing.

`packages/<pkg>/package.json` (replace `<pkg>` and `<description>`):

```json
{
  "name": "@technical-1/<pkg>",
  "version": "0.0.0",
  "description": "<description>",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@technical-1/core": "workspace:*"
  }
}
```

`packages/<pkg>/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

`packages/<pkg>/tsup.config.ts`:

```ts
export { default } from "../../tsup.config.base.js";
```

`packages/<pkg>/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

`packages/<pkg>/src/index.ts` (placeholder, replaced in that package's surface task):

```ts
export {};
```

---

### Task 1: `@technical-1/retry` scaffold

**Files:**
- Create: `packages/retry/package.json`
- Create: `packages/retry/tsconfig.json`
- Create: `packages/retry/tsup.config.ts`
- Create: `packages/retry/vitest.config.ts`
- Create: `packages/retry/README.md`
- Create: `packages/retry/src/index.ts`

- [ ] **Step 1: Create the 5 skeleton files** using the canonical skeleton
  above with `<pkg>` = `retry`, `<description>` =
  `Generic backoff/retry wrappers keyed off the @technical-1/core retryable error contract`.

- [ ] **Step 2: Create `packages/retry/README.md`**

```markdown
# @technical-1/retry

Generic async retry with exponential backoff and jitter. Retry-vs-terminal is
decided by the **property** contract from `@technical-1/core` (an error's
`retryable === true`), never by `instanceof` — safe across the dual ESM/CJS
package boundary.

```ts
import { withRetry } from "@technical-1/retry";

const html = await withRetry(() => fetchPage(url), { retries: 4 });
```

`withRetry(fn, opts?)` calls `fn(attempt)` (1-based). On a thrown error it
retries iff `opts.isRetryable(err)` is true (default: `err?.retryable === true`)
and attempts remain; otherwise it rethrows. Delays grow
`minDelayMs * factor^(attempt-1)`, capped at `maxDelayMs`, optionally jittered.
An `AbortSignal` cancels pending waits.
```

- [ ] **Step 3: Re-resolve workspace and verify the package links with its core dep**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: install succeeds; output lists `@technical-1/retry`. Confirm
`packages/retry/package.json` `dependencies` has `"@technical-1/core": "workspace:*"`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(retry): scaffold @technical-1/retry package"
```

---

### Task 2: `@technical-1/retry` implementation (TDD)

**Files:**
- Create: `packages/retry/src/retry.ts`
- Test: `packages/retry/src/retry.test.ts`

- [ ] **Step 1: Write the failing test** `packages/retry/src/retry.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry.js";
import { NavigationError, SelectorNotFoundError } from "@technical-1/core";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Convention (roadmap): for a rejection-path test, attach the `.rejects`
// assertion BEFORE draining fake timers so the handler exists when the
// promise rejects. No `settle()` helper; no dangerouslyIgnoreUnhandledErrors.

describe("withRetry", () => {
  it("resolves on first success without delay", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const p = withRetry(fn);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("retries a retryable error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NavigationError("https://x.test"))
      .mockResolvedValue("ok");
    const p = withRetry(fn, { retries: 3, minDelayMs: 10 });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a terminal (non-retryable) error", async () => {
    const fn = vi.fn().mockRejectedValue(new SelectorNotFoundError("#x"));
    const p = withRetry(fn, { retries: 5 });
    const assertion = expect(p).rejects.toBeInstanceOf(SelectorNotFoundError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws the last error", async () => {
    const err = new NavigationError("https://x.test");
    const fn = vi.fn().mockRejectedValue(err);
    const p = withRetry(fn, { retries: 2, minDelayMs: 1 });
    const assertion = expect(p).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("honors a custom isRetryable predicate", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("plain transient"))
      .mockResolvedValue("ok");
    const isRetryable = (e: unknown) =>
      e instanceof Error && e.message.includes("transient");
    const p = withRetry(fn, { retries: 2, minDelayMs: 1, isRetryable });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rejects immediately when the abort signal is already aborted", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const controller = new AbortController();
    controller.abort();
    await expect(
      withRetry(fn, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/retry test`
Expected: FAIL — cannot resolve `./retry.js`.

- [ ] **Step 3: Write minimal implementation** `packages/retry/src/retry.ts`

```ts
import type { LoggerOption } from "@technical-1/core";

export interface RetryOptions extends LoggerOption {
  /** Number of retries after the initial attempt. Default 3. */
  retries?: number;
  /** Base delay in ms before the first retry. Default 200. */
  minDelayMs?: number;
  /** Maximum delay in ms between retries. Default 5000. */
  maxDelayMs?: number;
  /** Exponential growth factor. Default 2. */
  factor?: number;
  /** Apply random jitter in [0, delay). Default true. */
  jitter?: boolean;
  /** Cancellation signal; aborts pending waits and prevents further attempts. */
  signal?: AbortSignal;
  /**
   * Decide whether a thrown error is retryable. Default: cross-realm-safe
   * property check (`err.retryable === true`) per the @technical-1/core
   * contract — intentionally NOT an `instanceof` check.
   */
  isRetryable?: (err: unknown) => boolean;
}

function defaultIsRetryable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "retryable" in err &&
    (err as { retryable?: unknown }).retryable === true
  );
}

function delayFor(attempt: number, o: Required<Pick<RetryOptions, "minDelayMs" | "maxDelayMs" | "factor" | "jitter">>): number {
  const raw = o.minDelayMs * Math.pow(o.factor, attempt - 1);
  const capped = Math.min(raw, o.maxDelayMs);
  return o.jitter ? Math.random() * capped : capped;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Run `fn(attempt)` (attempt is 1-based) with exponential backoff. Retries
 * only retryable errors while attempts remain; otherwise rethrows the error.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const cfg = {
    minDelayMs: opts.minDelayMs ?? 200,
    maxDelayMs: opts.maxDelayMs ?? 5000,
    factor: opts.factor ?? 2,
    jitter: opts.jitter ?? true,
  };
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  if (opts.signal?.aborted) throw new Error("Aborted before first attempt");

  let attempt = 0;
  // Always exits via `return` (success) or `throw` (exhausted / non-retryable / aborted).
  while (true) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      const exhausted = attempt > retries;
      if (exhausted || !isRetryable(err)) throw err;
      opts.logger?.log(
        `retry ${attempt}/${retries} after error: ${
          err instanceof Error ? err.message : String(err)
        }`,
        "warn",
      );
      await sleep(delayFor(attempt, cfg), opts.signal);
    }
  }
}
```

- [ ] **Step 4: Run, confirm pass + typecheck**

Run: `pnpm --filter @technical-1/retry test`
Expected: PASS — all 6 tests green.
Run: `pnpm --filter @technical-1/retry typecheck`
Expected: clean (0 errors). The repo's flat ESLint config does NOT enable
`no-constant-condition`, so `while (true)` needs no disable directive (adding
one produces an "unused eslint-disable" warning). Do not restructure the loop.

- [ ] **Step 5: Commit**

```bash
git add packages/retry/src/retry.ts packages/retry/src/retry.test.ts
git commit -m "feat(retry): add withRetry backoff keyed off core retryable contract"
```

---

### Task 3: `@technical-1/retry` public surface + build

**Files:**
- Modify: `packages/retry/src/index.ts`
- Test: `packages/retry/src/index.test.ts`

- [ ] **Step 1: Write failing test** `packages/retry/src/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as retry from "./index.js";

describe("public surface", () => {
  it("exposes exactly withRetry as the runtime export", () => {
    expect(typeof retry.withRetry).toBe("function");
    expect(Object.keys(retry).sort()).toEqual(["withRetry"].sort());
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/retry test`
Expected: FAIL — `retry.withRetry` undefined (index is `export {}`).

- [ ] **Step 3: Replace `packages/retry/src/index.ts`**

```ts
export { withRetry } from "./retry.js";
export type { RetryOptions } from "./retry.js";
```

- [ ] **Step 4: Run, confirm pass + build**

Run: `pnpm --filter @technical-1/retry test` → PASS (7 tests total).
Run: `pnpm --filter @technical-1/retry typecheck && pnpm --filter @technical-1/retry build`
Expected: typecheck clean; tsup emits dist.

- [ ] **Step 5: Verify the four dual-build artifacts**

Run: `ls packages/retry/dist/index.js packages/retry/dist/index.cjs packages/retry/dist/index.d.ts packages/retry/dist/index.d.cts`
Expected: all four print.

- [ ] **Step 6: Commit**

```bash
git add packages/retry/src/index.ts packages/retry/src/index.test.ts
git commit -m "feat(retry): expose public surface; verify dual build"
```

---

### Task 4: `@technical-1/logger` scaffold

**Files:**
- Create: `packages/logger/package.json`
- Create: `packages/logger/tsconfig.json`
- Create: `packages/logger/tsup.config.ts`
- Create: `packages/logger/vitest.config.ts`
- Create: `packages/logger/README.md`
- Create: `packages/logger/src/index.ts`

- [ ] **Step 1: Create the 5 skeleton files** using the canonical skeleton with
  `<pkg>` = `logger`, `<description>` =
  `Console and EventEmitter implementations of the @technical-1/core Logger interface`.

- [ ] **Step 2: Create `packages/logger/README.md`**

```markdown
# @technical-1/logger

Concrete implementations of the `Logger` interface from `@technical-1/core`.
Packages never import this directly — the consumer injects an instance.

- `createConsoleLogger({ minLevel? })` — writes to the appropriate `console`
  method per level, filtering anything below `minLevel`.
- `createEventLogger()` → `EventLogger` (extends Node `EventEmitter`) — emits a
  `"log"` event `{ message, level }`; this is what lets the Electron template
  stream package log lines into its UI panel without any package knowing
  Electron exists.

**Default level:** `Logger.log(message, level?)` leaves `level` optional. This
package defines the default: when `level` is omitted it is treated as
`"info"`. (The `@technical-1/core` interface deliberately imposes no default.)

```ts
import { createConsoleLogger, createEventLogger } from "@technical-1/logger";
```
```

- [ ] **Step 3: Re-resolve workspace**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: lists `@technical-1/logger`; its `dependencies` has
`"@technical-1/core": "workspace:*"`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(logger): scaffold @technical-1/logger package"
```

---

### Task 5: `@technical-1/logger` implementation (TDD)

**Files:**
- Create: `packages/logger/src/console-logger.ts`
- Create: `packages/logger/src/event-logger.ts`
- Test: `packages/logger/src/console-logger.test.ts`
- Test: `packages/logger/src/event-logger.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/logger/src/console-logger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createConsoleLogger } from "./console-logger.js";

let spies: Record<string, ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  spies = {
    debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
});
afterEach(() => vi.restoreAllMocks());

describe("createConsoleLogger", () => {
  it("routes levels to the matching console method", () => {
    const log = createConsoleLogger();
    log.log("d", "debug");
    log.log("i", "info");
    log.log("s", "step");
    log.log("ok", "success");
    log.log("w", "warn");
    log.log("e", "error");
    expect(spies.debug).toHaveBeenCalledWith("d");
    expect(spies.info).toHaveBeenCalledWith("i");
    expect(spies.info).toHaveBeenCalledWith("s");
    expect(spies.info).toHaveBeenCalledWith("ok");
    expect(spies.warn).toHaveBeenCalledWith("w");
    expect(spies.error).toHaveBeenCalledWith("e");
  });

  it("treats an omitted level as info", () => {
    createConsoleLogger().log("no level");
    expect(spies.info).toHaveBeenCalledWith("no level");
  });

  it("filters messages below minLevel", () => {
    const log = createConsoleLogger({ minLevel: "warn" });
    log.log("ignored", "info");
    log.log("kept", "error");
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledWith("kept");
    log.log("boundary", "warn");
    expect(spies.warn).toHaveBeenCalledWith("boundary"); // level == minLevel → kept
  });
});
```

`packages/logger/src/event-logger.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createEventLogger } from "./event-logger.js";

describe("createEventLogger", () => {
  it("emits a log event with message and level", () => {
    const logger = createEventLogger();
    const handler = vi.fn();
    logger.on("log", handler);
    logger.log("hello", "step");
    expect(handler).toHaveBeenCalledWith({ message: "hello", level: "step" });
  });

  it("defaults an omitted level to info in the emitted event", () => {
    const logger = createEventLogger();
    const handler = vi.fn();
    logger.on("log", handler);
    logger.log("bare");
    expect(handler).toHaveBeenCalledWith({ message: "bare", level: "info" });
  });

  it("delivers each log to every subscribed listener", () => {
    const logger = createEventLogger();
    const h1 = vi.fn();
    const h2 = vi.fn();
    logger.on("log", h1);
    logger.on("log", h2);
    logger.log("broadcast", "info");
    expect(h1).toHaveBeenCalledWith({ message: "broadcast", level: "info" });
    expect(h2).toHaveBeenCalledWith({ message: "broadcast", level: "info" });
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/logger test`
Expected: FAIL — cannot resolve `./console-logger.js` / `./event-logger.js`.

- [ ] **Step 3: Write implementations**

`packages/logger/src/console-logger.ts`:

```ts
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
```

`packages/logger/src/event-logger.ts`:

```ts
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
```

- [ ] **Step 4: Run, confirm pass + typecheck**

Run: `pnpm --filter @technical-1/logger test` → PASS (6 tests).
Run: `pnpm --filter @technical-1/logger typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/logger/src/console-logger.ts packages/logger/src/event-logger.ts packages/logger/src/console-logger.test.ts packages/logger/src/event-logger.test.ts
git commit -m "feat(logger): add console and EventEmitter Logger implementations"
```

---

### Task 6: `@technical-1/logger` public surface + build

**Files:**
- Modify: `packages/logger/src/index.ts`
- Test: `packages/logger/src/index.test.ts`

- [ ] **Step 1: Write failing test** `packages/logger/src/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as logger from "./index.js";

describe("public surface", () => {
  it("exposes the two factories and the EventLogger class only", () => {
    expect(typeof logger.createConsoleLogger).toBe("function");
    expect(typeof logger.createEventLogger).toBe("function");
    expect(typeof logger.EventLogger).toBe("function");
    expect(Object.keys(logger).sort()).toEqual(
      ["EventLogger", "createConsoleLogger", "createEventLogger"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/logger test`
Expected: FAIL — exports undefined.

- [ ] **Step 3: Replace `packages/logger/src/index.ts`**

```ts
export { createConsoleLogger } from "./console-logger.js";
export type { ConsoleLoggerOptions } from "./console-logger.js";
export { EventLogger, createEventLogger } from "./event-logger.js";
export type { LogEvent } from "./event-logger.js";
```

- [ ] **Step 4: Run, confirm pass + build**

Run: `pnpm --filter @technical-1/logger test` → PASS (7 tests).
Run: `pnpm --filter @technical-1/logger typecheck && pnpm --filter @technical-1/logger build` → clean + dist emitted.

- [ ] **Step 5: Verify dual-build artifacts**

Run: `ls packages/logger/dist/index.js packages/logger/dist/index.cjs packages/logger/dist/index.d.ts packages/logger/dist/index.d.cts`
Expected: all four print.

- [ ] **Step 6: Commit**

```bash
git add packages/logger/src/index.ts packages/logger/src/index.test.ts
git commit -m "feat(logger): expose public surface; verify dual build"
```

---

### Task 7: `@technical-1/config` scaffold

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/tsup.config.ts`
- Create: `packages/config/vitest.config.ts`
- Create: `packages/config/README.md`
- Create: `packages/config/src/index.ts`

- [ ] **Step 1: Create the 5 skeleton files** using the canonical skeleton with
  `<pkg>` = `config`, `<description>` =
  `Typed environment/options loader with schema and defaults for the @technical-1 suite`.

- [ ] **Step 2: Create `packages/config/README.md`**

```markdown
# @technical-1/config

A tiny typed loader: declare a schema mapping config keys to env var names,
defaults, and parsers; `loadConfig` returns a fully-typed object. Missing
required keys throw a `@technical-1/core` `PptrKitError` carrying the offending
env var in `context`.

```ts
import { loadConfig } from "@technical-1/config";

const cfg = loadConfig({
  headless: { env: "PPTR_HEADLESS", default: true, parse: (v) => v !== "false" },
  captchaKey: { env: "CAPTCHA_API_KEY", required: true },
});
```

No bundled credentials or secrets — values come only from the supplied env.
```

- [ ] **Step 3: Re-resolve workspace**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: lists `@technical-1/config`; dependencies has
`"@technical-1/core": "workspace:*"`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(config): scaffold @technical-1/config package"
```

---

### Task 8: `@technical-1/config` implementation (TDD)

**Files:**
- Create: `packages/config/src/config.ts`
- Test: `packages/config/src/config.test.ts`

- [ ] **Step 1: Write the failing test** `packages/config/src/config.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";
import { PptrKitError } from "@technical-1/core";

describe("loadConfig", () => {
  it("uses defaults when env vars are unset", () => {
    const cfg = loadConfig(
      { headless: { env: "X_HEADLESS", default: true } },
      {},
    );
    expect(cfg.headless).toBe(true);
  });

  it("reads from env and applies parse", () => {
    const cfg = loadConfig(
      { headless: { env: "X_HEADLESS", default: true, parse: (v) => v !== "false" } },
      { X_HEADLESS: "false" },
    );
    expect(cfg.headless).toBe(false);
  });

  it("returns the raw string when no parser is given", () => {
    const cfg = loadConfig({ key: { env: "X_KEY" } }, { X_KEY: "abc" });
    expect(cfg.key).toBe("abc");
  });

  it("throws a PptrKitError naming the env var when a required key is missing", () => {
    try {
      loadConfig({ key: { env: "X_KEY", required: true } }, {});
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PptrKitError);
      expect((err as PptrKitError).message).toContain("X_KEY");
      expect((err as PptrKitError).context).toEqual({ env: "X_KEY" });
    }
  });

  it("treats an empty-string env var as missing for a required field", () => {
    expect(() =>
      loadConfig({ key: { env: "X_KEY", required: true } }, { X_KEY: "" }),
    ).toThrow(PptrKitError);
  });

  it("uses the default (no throw) when a field is both required and has a default", () => {
    const cfg = loadConfig(
      { key: { env: "X_KEY", required: true, default: "fallback" } },
      {},
    );
    expect(cfg.key).toBe("fallback");
  });

  it("keeps a falsy default when the env var is absent", () => {
    const cfg = loadConfig(
      {
        flag: { env: "X_FLAG", default: false },
        count: { env: "X_COUNT", default: 0 },
        name: { env: "X_NAME", default: "" },
      },
      {},
    );
    expect(cfg.flag).toBe(false);
    expect(cfg.count).toBe(0);
    expect(cfg.name).toBe("");
  });

  it("yields undefined (no throw) for an optional field with no default and no env var", () => {
    const cfg = loadConfig({ opt: { env: "X_OPT" } }, {});
    expect(cfg.opt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/config test`
Expected: FAIL — cannot resolve `./config.js`.

- [ ] **Step 3: Write minimal implementation** `packages/config/src/config.ts`

```ts
import { PptrKitError } from "@technical-1/core";

export interface ConfigField<V> {
  /** Environment variable name to read. */
  env: string;
  /** Value used when the env var is absent OR set to an empty string. */
  default?: V;
  /** Convert the raw string to V. Omit to keep the raw string. */
  parse?: (raw: string) => V;
  /**
   * When true, a missing env var with no `default` throws a core
   * `PptrKitError`. "Missing" means unset OR an empty string — a blank
   * value does NOT satisfy a required field. If a `default` is also
   * provided, the default is used and nothing is thrown.
   */
  required?: boolean;
}

export type ConfigSchema<T> = { [K in keyof T]: ConfigField<T[K]> };

/**
 * Resolve a typed config object from a schema. Reads `env` (defaults to
 * `process.env`). An env var that is unset OR an empty string is treated as
 * absent. A missing required field with no `default` throws a core
 * `PptrKitError` whose `context` carries the offending env var NAME (never
 * its value — no secret leakage).
 */
export function loadConfig<T>(
  schema: ConfigSchema<T>,
  env: Record<string, string | undefined> = process.env,
): T {
  const out: Partial<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = schema[key];
    const raw = env[field.env];
    const missing = raw === undefined || raw === "";
    if (missing) {
      if (field.required && field.default === undefined) {
        throw new PptrKitError(`Missing required config: ${field.env}`, {
          context: { env: field.env },
        });
      }
      out[key] = field.default as T[keyof T];
    } else {
      out[key] = (field.parse ? field.parse(raw) : raw) as T[keyof T];
    }
  }
  // Single assertion: the loader trusts the caller's schema to cover every
  // non-optional key of T (via a default or a present/required env var).
  return out as T;
}
```

- [ ] **Step 4: Run, confirm pass + typecheck**

Run: `pnpm --filter @technical-1/config test` → PASS (4 tests).
Run: `pnpm --filter @technical-1/config typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/config/src/config.ts packages/config/src/config.test.ts
git commit -m "feat(config): add typed env/options loader throwing core errors"
```

---

### Task 9: `@technical-1/config` public surface + build

**Files:**
- Modify: `packages/config/src/index.ts`
- Test: `packages/config/src/index.test.ts`

- [ ] **Step 1: Write failing test** `packages/config/src/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as config from "./index.js";

describe("public surface", () => {
  it("exposes exactly loadConfig as the runtime export", () => {
    expect(typeof config.loadConfig).toBe("function");
    expect(Object.keys(config).sort()).toEqual(["loadConfig"].sort());
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/config test`
Expected: FAIL — `config.loadConfig` undefined.

- [ ] **Step 3: Replace `packages/config/src/index.ts`**

```ts
export { loadConfig } from "./config.js";
export type { ConfigField, ConfigSchema } from "./config.js";
```

- [ ] **Step 4: Run, confirm pass + build**

Run: `pnpm --filter @technical-1/config test` → PASS (5 tests).
Run: `pnpm --filter @technical-1/config typecheck && pnpm --filter @technical-1/config build` → clean + dist.

- [ ] **Step 5: Verify dual-build artifacts**

Run: `ls packages/config/dist/index.js packages/config/dist/index.cjs packages/config/dist/index.d.ts packages/config/dist/index.d.cts`
Expected: all four print.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src/index.ts packages/config/src/index.test.ts
git commit -m "feat(config): expose public surface; verify dual build"
```

---

### Task 10: Changesets + whole-monorepo CI gate

**Files:**
- Create: `.changeset/utility-tier.md`

- [ ] **Step 1: Create `.changeset/utility-tier.md`**

```markdown
---
"@technical-1/retry": minor
"@technical-1/logger": minor
"@technical-1/config": minor
---

Initial release of the utility tier: `withRetry` (backoff keyed off the core
`retryable` contract), console + EventEmitter `Logger` implementations, and a
typed env/options `loadConfig`.
```

- [ ] **Step 2: Whole-monorepo CI (the real gate)**

Run: `pnpm install && pnpm run ci`
Expected: `turbo run typecheck lint test build` succeeds for ALL four packages
(`core`, `retry`, `logger`, `config`). Capture the turbo summary and per-package
test counts (core 13, retry 10, logger 7, config 9 — counts grew from
code-review hardening: retry +abort-mid-sleep/logger-warn/backoff, config
+empty-string/required-default/falsy-default/optional).

- [ ] **Step 3: Invariant sweep**

Run: `grep -rn "autom8ops" packages/ docs/ .changeset/ .github/ 2>/dev/null | grep -v node_modules || echo "clean"`
Expected: prints `clean` (the literal token appears nowhere).

- [ ] **Step 4: Commit**

```bash
git add .changeset/utility-tier.md
git commit -m "chore: changeset for the utility tier (retry, logger, config)"
```

---

## Self-Review

**Spec coverage (this plan's slice — utility tier):**
- §5 catalog: `retry` (backoff/retry, dep `core`) ✓ Tasks 1–3; `logger`
  (console + EventEmitter impls, dep `core`) ✓ Tasks 4–6; `config` (env/options
  loader with typed schema + defaults, dep `core`) ✓ Tasks 7–9.
- §4.1 no `puppeteer-core` peer (these are browser-agnostic) ✓ skeleton has no
  `peerDependencies`.
- §4.2 acyclic graph: each depends only on `core` via `workspace:*`, no
  capability cross-deps ✓.
- §4.3 DI logging: `retry` accepts `logger?` via `LoggerOption`, never imports
  an impl; `logger` is the impl package ✓.
- §4.4 function-first: `withRetry`, `createConsoleLogger`, `createEventLogger`,
  `loadConfig` are functions; `EventLogger` is a class only because
  EventEmitter lifecycle is intrinsic ✓.
- §4.5 per-package layout (canonical exports, tsup re-export, vitest config,
  README, sideEffects:false) ✓ skeleton.
- §4.6/§8 typed errors: `config` throws core `PptrKitError` with `context`;
  `retry`'s default predicate uses the property contract, not `instanceof` ✓.
- §9 testing: every exported function has ≥1 unit test; `retry` uses fake
  timers (no real waits, no network) ✓; no live-internet ✓.
- §10 tooling: `workspace:*` internal dep, Turbo pipeline, Changesets entry,
  shared base configs ✓.
- Roadmap conventions: canonical exports map, per-package vitest config,
  property-based error detection, logger default-level = "info" all honored ✓.
- Out of scope (correctly deferred): capability packages, integration fixture
  server, publish wiring, the tsup duplicate-sourcemap fix — later plans.

**Placeholder scan:** Each package ships a deliberate `export {}` in its
scaffold task, fully replaced in that package's surface task (3/6/9). No
"TBD"/"add error handling"/"similar to Task N". The canonical skeleton is
written out once and explicitly referenced (with full content) — not "same as
Task 1".

**Type consistency:** `RetryOptions`/`ConfigField`/`ConfigSchema`/
`ConsoleLoggerOptions`/`LogEvent`/`EventLogger` are defined in their
implementation tasks and re-exported with identical names in the matching
surface task and asserted by the exact-`Object.keys` barrel test. `withRetry`,
`loadConfig`, `createConsoleLogger`, `createEventLogger` names are consistent
across implementation, index, README, and tests. `LoggerOption` is consumed
from `core` (defined Plan 01) — name matches.
