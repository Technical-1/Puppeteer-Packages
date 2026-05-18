# Packages Foundation + `@technical-1/core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `Puppeteer-Packages` pnpm monorepo (workspaces +
Turborepo + Changesets + shared TS/tsup/vitest/CI) with the foundational
`@technical-1/core` package fully built, tested, and ready to publish.

**Architecture:** A pnpm-workspace monorepo. Shared base configs at the root
(`tsconfig.base.json`, `tsup.config.base.ts`, root vitest/eslint). Each package
under `packages/<name>/` compiles TypeScript → ESM + CJS + `.d.ts` via `tsup`,
has an `exports` map, its own vitest suite, README, and declared
`peerDependencies`. `@technical-1/core` has zero runtime deps and exports the
shared type/option shapes, the typed error hierarchy (with a `retryable` flag
the future `retry` package keys off), and the `Logger` interface.

**Tech Stack:** pnpm workspaces, Turborepo, Changesets, TypeScript (NodeNext,
strict), tsup, vitest, ESLint (flat config), GitHub Actions. Node 20 & 22.

**Working directory:** `/Users/jacobkanfer/Desktop/Code/Puppeteer-Packages`
(empty git repo, branch `main`, authorship already set to
`Jacob Kanfer <kanfer@users.noreply.github.com>`).

**Invariant:** The prohibited work-brand string named in the architecture spec
§3 must never appear in any file (this plan deliberately avoids the literal
token). Commits use
the configured local git identity (do not pass `--author`).

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `tsconfig.base.json`
- Create: `turbo.json`
- Create: `.changeset/config.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "puppeteer-packages",
  "private": true,
  "version": "0.0.0",
  "description": "Reusable Puppeteer capability suite — @technical-1/* packages",
  "license": "MIT",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "ci": "turbo run typecheck lint test build",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.9",
    "@typescript-eslint/eslint-plugin": "^8.13.0",
    "@typescript-eslint/parser": "^8.13.0",
    "eslint": "^9.14.0",
    "tsup": "^8.3.5",
    "turbo": "^2.2.3",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "examples"
```

- [ ] **Step 3: Create `.npmrc`**

```
auto-install-peers=false
strict-peer-dependencies=false
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
coverage/
*.log
.DS_Store
```

- [ ] **Step 5: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 6: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 7: Create `.changeset/config.json`**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 8: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes without error; creates `node_modules/` and
`pnpm-lock.yaml`. `pnpm turbo --version` prints a 2.x version.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo (workspaces, turbo, changesets, tsconfig base)"
```

---

### Task 2: Shared build & test tooling

**Files:**
- Create: `tsup.config.base.ts`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`

- [ ] **Step 1: Create `tsup.config.base.ts`** (packages import this so build output is uniform)

```ts
import { defineConfig, type Options } from "tsup";

/** Shared tsup options: ESM + CJS + .d.ts, tree-shakeable, no bundled deps. */
export function baseTsup(overrides: Options = {}): Options {
  return {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    target: "es2022",
    ...overrides,
  };
}

export default defineConfig(baseTsup());
```

- [ ] **Step 2: Create root `vitest.config.ts`** (discovers every package's tests)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
```

- [ ] **Step 3: Create `eslint.config.js`** (flat config, TypeScript)

```js
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["packages/**/src/**/*.ts"],
    ignores: ["**/dist/**", "**/*.test.ts"],
    languageOptions: { parser: tsparser },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
```

- [ ] **Step 4: Verify tooling loads with no packages yet**

Run: `pnpm exec eslint --version && pnpm exec vitest --version && pnpm exec tsup --version`
Expected: each prints a version; no config parse errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add shared tsup/vitest/eslint base configuration"
```

---

### Task 3: `@technical-1/core` package scaffold

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/README.md`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@technical-1/core",
  "version": "0.0.0",
  "description": "Shared types, typed error hierarchy, and Logger interface for the @technical-1 Puppeteer suite",
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
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/core/tsup.config.ts`**

```ts
export { default } from "../../tsup.config.base.js";
```

- [ ] **Step 4: Create `packages/core/README.md`**

```markdown
# @technical-1/core

Foundational package for the `@technical-1` Puppeteer capability suite. Zero
runtime dependencies. Every capability package depends on this for shared
contracts.

Exports:

- **Typed error hierarchy** — `PptrKitError` (base) and
  `SelectorNotFoundError`, `NavigationError`, `TimeoutError`, `CaptchaError`,
  `ProxyError`, `SessionError`. Each carries a `retryable` flag and a
  structured `context`.
- **`Logger` interface** — the dependency-injected logging contract. No
  implementation lives here (see `@technical-1/logger`).
- **Shared option shapes** — `LoggerOption`, `TimeoutOption`.

```ts
import { SelectorNotFoundError, type Logger } from "@technical-1/core";
```
```

- [ ] **Step 4b: Create `packages/core/vitest.config.ts`** (per-package config so
  `vitest run` resolves the package's tests when invoked from the package dir
  via `pnpm --filter`/Turbo's per-package `test` task; the root
  `vitest.config.ts` still drives workspace-level runs)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 5: Create placeholder `packages/core/src/index.ts`** (replaced in Task 6)

```ts
export {};
```

- [ ] **Step 6: Re-resolve workspace and verify the package is linked**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: output lists `@technical-1/core`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(core): scaffold @technical-1/core package"
```

---

### Task 4: Typed error hierarchy (TDD)

**Files:**
- Create: `packages/core/src/errors.ts`
- Test: `packages/core/src/errors.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PptrKitError,
  SelectorNotFoundError,
  NavigationError,
  TimeoutError,
  CaptchaError,
  ProxyError,
  SessionError,
} from "./errors.js";

describe("PptrKitError", () => {
  it("is an Error with a name matching the subclass and defaults retryable=false", () => {
    const e = new PptrKitError("boom");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PptrKitError");
    expect(e.retryable).toBe(false);
    expect(e.context).toEqual({});
  });

  it("carries cause and context and an explicit retryable flag", () => {
    const cause = new Error("root");
    const e = new PptrKitError("wrap", { cause, retryable: true, context: { a: 1 } });
    expect(e.cause).toBe(cause);
    expect(e.retryable).toBe(true);
    expect(e.context).toEqual({ a: 1 });
  });
});

describe("subclasses", () => {
  it("SelectorNotFoundError carries the selector and is terminal", () => {
    const e = new SelectorNotFoundError("#missing");
    expect(e).toBeInstanceOf(PptrKitError);
    expect(e.name).toBe("SelectorNotFoundError");
    expect(e.selector).toBe("#missing");
    expect(e.retryable).toBe(false);
    expect(e.message).toContain("#missing");
  });

  it("NavigationError carries the url + cause and is retryable", () => {
    const cause = new Error("net");
    const e = new NavigationError("https://x.test", { cause });
    expect(e.url).toBe("https://x.test");
    expect(e.cause).toBe(cause);
    expect(e.retryable).toBe(true);
  });

  it("TimeoutError and ProxyError are retryable; CaptchaError and SessionError are terminal", () => {
    expect(new TimeoutError("slow").retryable).toBe(true);
    expect(new ProxyError("bad proxy").retryable).toBe(true);
    expect(new CaptchaError("blocked").retryable).toBe(false);
    expect(new SessionError("no session").retryable).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/core test`
Expected: FAIL — cannot resolve `./errors.js` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/errors.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/core test`
Expected: PASS — all error tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/errors.ts packages/core/src/errors.test.ts
git commit -m "feat(core): add typed error hierarchy with retryable flag"
```

---

### Task 5: `Logger` interface + shared option shapes (TDD)

**Files:**
- Create: `packages/core/src/logger.ts`
- Create: `packages/core/src/types.ts`
- Test: `packages/core/src/contracts.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/contracts.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { Logger, LogLevel } from "./logger.js";
import type { LoggerOption, TimeoutOption } from "./types.js";
import { LOG_LEVELS } from "./logger.js";

describe("Logger contract", () => {
  it("LOG_LEVELS lists the supported levels in order", () => {
    expect(LOG_LEVELS).toEqual(["debug", "info", "step", "success", "warn", "error"]);
  });

  it("a conforming Logger receives message + level", () => {
    const log = vi.fn();
    const logger: Logger = { log };
    const level: LogLevel = "step";
    logger.log("hello", level);
    expect(log).toHaveBeenCalledWith("hello", "step");
  });

  it("option shapes accept an injected logger and a timeout", () => {
    const opt: LoggerOption & TimeoutOption = { logger: { log: () => {} }, timeout: 5000 };
    expect(opt.timeout).toBe(5000);
    expect(typeof opt.logger?.log).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/core test`
Expected: FAIL — cannot resolve `./logger.js` / `./types.js`.

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/logger.ts`:

```ts
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
```

`packages/core/src/types.ts`:

```ts
import type { Logger } from "./logger.js";

/** Mixed into option objects for packages that emit log lines. */
export interface LoggerOption {
  logger?: Logger;
}

/** Mixed into option objects for time-bounded operations (milliseconds). */
export interface TimeoutOption {
  timeout?: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/core test`
Expected: PASS — contract tests green (error tests still green too).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logger.ts packages/core/src/types.ts packages/core/src/contracts.test.ts
git commit -m "feat(core): add Logger interface and shared option shapes"
```

---

### Task 6: Public surface + build verification

**Files:**
- Modify: `packages/core/src/index.ts` (replace the `export {}` placeholder)
- Test: `packages/core/src/index.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as core from "./index.js";

describe("public surface", () => {
  it("re-exports the error hierarchy, Logger constants, and is otherwise minimal", () => {
    expect(typeof core.PptrKitError).toBe("function");
    expect(typeof core.SelectorNotFoundError).toBe("function");
    expect(typeof core.NavigationError).toBe("function");
    expect(typeof core.TimeoutError).toBe("function");
    expect(typeof core.CaptchaError).toBe("function");
    expect(typeof core.ProxyError).toBe("function");
    expect(typeof core.SessionError).toBe("function");
    expect(core.LOG_LEVELS).toContain("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @technical-1/core test`
Expected: FAIL — `core.PptrKitError` is undefined (index still `export {}`).

- [ ] **Step 3: Replace `packages/core/src/index.ts`**

```ts
export {
  PptrKitError,
  SelectorNotFoundError,
  NavigationError,
  TimeoutError,
  CaptchaError,
  ProxyError,
  SessionError,
} from "./errors.js";
export type { ErrorContext, PptrKitErrorOptions } from "./errors.js";
export { LOG_LEVELS } from "./logger.js";
export type { Logger, LogLevel } from "./logger.js";
export type { LoggerOption, TimeoutOption } from "./types.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @technical-1/core test`
Expected: PASS — all suites green.

- [ ] **Step 5: Typecheck and build the package**

Run: `pnpm --filter @technical-1/core typecheck && pnpm --filter @technical-1/core build`
Expected: `tsc --noEmit` clean; tsup writes
`packages/core/dist/index.js`, `index.cjs`, `index.d.ts` (+ `.map` files).

- [ ] **Step 6: Verify the three build artifacts exist**

Run: `ls packages/core/dist/index.js packages/core/dist/index.cjs packages/core/dist/index.d.ts packages/core/dist/index.d.cts`
Expected: all four paths print (no "No such file"). The `index.d.cts` is the
CJS type declaration wired by the `require` condition of the exports map.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat(core): expose public surface; verify ESM+CJS+dts build"
```

---

### Task 7: First changeset + CI workflow

**Files:**
- Create: `.changeset/initial-core.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the initial changeset for `core`**

`.changeset/initial-core.md`:

```markdown
---
"@technical-1/core": minor
---

Initial release: typed error hierarchy (`PptrKitError` + subclasses with a
`retryable` flag), `Logger` interface, and shared option shapes.
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run typecheck lint test build

  integration:
    runs-on: ubuntu-latest
    env:
      PPTR_IT: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - run: pnpm turbo run test
        # Integration specs are introduced in plan 09; this job runs the same
        # suite with PPTR_IT=1 and stays green until those specs exist.
```

- [ ] **Step 3: Verify the workflow YAML parses**

Run: `pnpm exec node -e "const c=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!c.includes('pnpm/action-setup')) process.exit(1); console.log('ci.yml OK')"`
Expected: prints `ci.yml OK`.

- [ ] **Step 4: Full local CI dry run**

Run: `pnpm run ci`
Expected: `turbo run typecheck lint test build` completes; `@technical-1/core`
passes every task.

- [ ] **Step 5: Commit**

```bash
git add .changeset/initial-core.md .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline and initial core changeset"
```

---

## Self-Review

**Spec coverage (this plan's slice — foundation + `core`):**
- §3 locked decisions: pnpm + Changesets + Turborepo ✓ (Tasks 1, 7); npm scope
  `@technical-1` ✓ (Task 3); TS → ESM+CJS+`.d.ts` ✓ (Tasks 2, 6); no
  the prohibited brand string ✓ (invariant; the literal token does not occur
  in this plan or in any file it creates).
- §4.2 `core` contents: shared types ✓ (Task 5 `types.ts`), error hierarchy ✓
  (Task 4), `Logger` interface ✓ (Task 5); zero runtime deps ✓ (Task 3
  package.json has no `dependencies`).
- §4.5 per-package layout: `src`→`dist` via tsup, `exports` map, vitest,
  README, side-effect-free ✓ (Tasks 2, 3, 6).
- §8 error handling: `retryable` flag the `retry` package will key off ✓
  (Task 4, asserted per-subclass).
- §10 tooling: `pnpm-workspace.yaml`, Turborepo pipeline `build→typecheck→
  lint→test`, Changesets, shared `tsconfig.base.json`, `ci.yml` matrix Node
  20/22 + separate integration job ✓ (Tasks 1, 2, 7).
- Out of scope here (correctly deferred): capability packages, `release.yml`
  publish wiring, integration fixture server — these are plans 02–09.

**Placeholder scan:** `src/index.ts` ships a deliberate `export {}` in Task 3
and is fully replaced with real exports in Task 6 — not a residual placeholder.
No "TBD"/"add error handling"/"similar to Task N" instances.

**Type consistency:** `PptrKitErrorOptions`, `ErrorContext`, `Logger`,
`LogLevel`, `LOG_LEVELS`, `LoggerOption`, `TimeoutOption` are defined in Tasks
4–5 and re-exported with the identical names in Task 6's `index.ts` and its
test. `retryable`/`context`/`selector`/`url` property names are consistent
across the implementation and every test.
