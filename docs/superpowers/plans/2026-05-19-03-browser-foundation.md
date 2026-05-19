# Browser Foundation (`chrome-setup`, `launcher`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@technical-1/chrome-setup` (resolve/download a Chrome build,
ported & de-Electron'd from the seeded Kanfer `chrome-path.js` +
`download-chrome.js`) and `@technical-1/launcher` (launch options + headless
toggle + a guaranteed-cleanup browser **pool**), fully built, tested, and
changeset-versioned.

**Architecture:** Two workspace packages.
- `chrome-setup` depends on `@technical-1/core` (`workspace:*`) and — uniquely
  in the suite (spec §4.1) — on `@puppeteer/browsers` as a real runtime
  dependency, because its job *is* fetching Chrome. It has **no**
  `puppeteer-core` peer (it resolves/downloads Chrome, never drives it). It is
  environment-agnostic: no Electron coupling (packaged-resource resolution is a
  template concern, deferred to Plan 10).
- `launcher` depends on `@technical-1/core` (`workspace:*`) and declares
  `puppeteer-core` as a **peerDependency** (spec §4.1 — the consumer owns the
  Puppeteer/Chrome version). It imports **only types** from `puppeteer-core`
  and **dependency-injects** the puppeteer launcher, so unit tests run with a
  mock (no real Chrome, no network — spec §9). It guarantees browser cleanup
  via `close()` in a `finally` (spec §8) so a thrown error never leaks a
  browser process.

These two patterns (peer + DI-mockable browser; the `@puppeteer/browsers`
exception) are inherited by every remaining capability package — getting them
right here is the point of this plan.

**Tech Stack:** TypeScript (NodeNext, strict, verbatimModuleSyntax), tsup,
vitest, `@puppeteer/browsers`, `puppeteer-core` (peer, types only).

**Working directory:** `/Users/jacobkanfer/Desktop/Code/Puppeteer-Packages`
(execution on `feat/03-browser-foundation`, branched from `main` at the Plan 02
tip). Authorship `Jacob Kanfer <kanfer@users.noreply.github.com>` (configured;
never pass `--author`).

**Invariants (roadmap — verify every task):** the prohibited work-brand string
named in spec §3 must never appear; canonical per-condition `exports` map;
per-package minimal `vitest.config.ts`; root `@types/node` (no per-pkg `lib`
override, no `DOM`); no dead `eslint-disable`; typed errors from `core` (use
base `PptrKitError` with `context` where no subclass fits); function-first APIs,
classes only for intrinsic state (the pool); fake/mocked tests only — **no real
Chrome, no network, no live internet** (spec §9, §12).

---

## Canonical package skeleton (Tasks 1 & 4 use this verbatim)

Identical to the Plan 02 skeleton. `packages/<pkg>/package.json` —
**`dependencies` / `peerDependencies` differ per package, noted in each task**:

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
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
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

`tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, placeholder
`src/index.ts` (`export {}`) are byte-identical to the Plan 02 skeleton:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": "src", "outDir": "dist" }, "include": ["src/**/*.ts"] }
```
```ts
export { default } from "../../tsup.config.base.js";
```
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```
```ts
export {};
```

---

### Task 1: `@technical-1/chrome-setup` scaffold

**Files:** `packages/chrome-setup/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1: Create the 5 skeleton files** with `<pkg>`=`chrome-setup`,
  `<description>`=`Resolve or download a Chrome build for the @technical-1 Puppeteer suite`.
  In `package.json`, the `dependencies` block is:

```json
  "dependencies": {
    "@technical-1/core": "workspace:*",
    "@puppeteer/browsers": "^2.4.0"
  }
```
  No `peerDependencies`. (`@puppeteer/browsers` is the spec §4.1 exception — the
  package whose job is fetching Chrome.)

- [ ] **Step 2: Create `packages/chrome-setup/README.md`**

```markdown
# @technical-1/chrome-setup

Resolve an existing Chrome-for-Testing build, or download one via
`@puppeteer/browsers`. Environment-agnostic — no Electron/bundler assumptions
(packaged-app resolution is a template concern, not this package's).

```ts
import { ensureChrome } from "@technical-1/chrome-setup";

const executablePath = await ensureChrome();
```

- `resolveChromePath(opts?)` — pure, synchronous; searches known cache
  directories, returns a path or `undefined`.
- `downloadChrome(opts?)` — downloads a pinned Chrome build, returns its
  `executablePath`.
- `ensureChrome(opts?)` — resolve, else download; throws a core `PptrKitError`
  if Chrome cannot be made available.
```

- [ ] **Step 3: Re-resolve workspace**

Run: `pnpm install && pnpm -r list --depth -1`
Expected: succeeds; lists `@technical-1/chrome-setup`; `dependencies` shows
`@technical-1/core` (workspace link) and `@puppeteer/browsers`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(chrome-setup): scaffold @technical-1/chrome-setup package"
```

---

### Task 2: `@technical-1/chrome-setup` implementation (TDD)

**Files:** Create `packages/chrome-setup/src/chrome.ts`; Test
`packages/chrome-setup/src/chrome.test.ts`.

Ported from the seeded Kanfer `modules/chrome-path.js` (executable search) +
`scripts/download-chrome.js` (`@puppeteer/browsers` install), de-Electron'd and
TypeScript'd. Tests use a real OS temp dir for path resolution (deterministic,
no network) and `vi.mock("@puppeteer/browsers")` for the download path (no real
download).

- [ ] **Step 1: Write the failing test** `packages/chrome-setup/src/chrome.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PptrKitError } from "@technical-1/core";

vi.mock("@puppeteer/browsers", () => ({
  Browser: { CHROME: "chrome" },
  detectBrowserPlatform: vi.fn(() => "mac_arm"),
  install: vi.fn(async () => ({ executablePath: "/downloaded/chrome" })),
}));

import * as browsers from "@puppeteer/browsers";
import { resolveChromePath, downloadChrome, ensureChrome } from "./chrome.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cs-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("resolveChromePath", () => {
  it("returns undefined when no Chrome binary is in the search dirs", () => {
    expect(resolveChromePath({ searchDirs: [dir] })).toBeUndefined();
  });

  it("finds a linux-style chrome binary nested in a search dir", () => {
    const nested = join(dir, "chrome", "linux-1");
    mkdirSync(nested, { recursive: true });
    const bin = join(nested, "chrome");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);
    const found = resolveChromePath({ searchDirs: [dir], platform: "linux" });
    expect(found).toBe(bin);
  });
});

describe("downloadChrome", () => {
  it("delegates to @puppeteer/browsers.install and returns the executablePath", async () => {
    const res = await downloadChrome({ cacheDir: dir, buildId: "100.0.0.0" });
    expect(browsers.install).toHaveBeenCalledWith(
      expect.objectContaining({ browser: "chrome", buildId: "100.0.0.0", cacheDir: dir }),
    );
    expect(res.executablePath).toBe("/downloaded/chrome");
  });
});

describe("ensureChrome", () => {
  it("returns an already-resolved path without downloading", async () => {
    const nested = join(dir, "win-1");
    mkdirSync(nested, { recursive: true });
    const bin = join(nested, "chrome.exe");
    writeFileSync(bin, "x");
    const path = await ensureChrome({ searchDirs: [dir], platform: "win32" });
    expect(path).toBe(bin);
    expect(browsers.install).not.toHaveBeenCalled();
  });

  it("downloads when nothing is resolvable, then returns the downloaded path", async () => {
    const path = await ensureChrome({ searchDirs: [dir], cacheDir: dir });
    expect(browsers.install).toHaveBeenCalled();
    expect(path).toBe("/downloaded/chrome");
  });

  it("throws a PptrKitError when resolve and download both yield nothing", async () => {
    (browsers.install as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ executablePath: "" });
    await expect(ensureChrome({ searchDirs: [dir], cacheDir: dir })).rejects.toBeInstanceOf(PptrKitError);
  });
});
```

> Code review added 5 more tests (commit `07c9732`): macOS `.app` descent;
> first-search-dir-wins precedence; `downloadChrome` logger step+success;
> `detectBrowserPlatform→undefined` throws `PptrKitError`; an `install()`
> failure is wrapped as a **retryable** `PptrKitError`. Final count: 11.

- [ ] **Step 2: Run, confirm failure**

Run: `pnpm --filter @technical-1/chrome-setup test`
Expected: FAIL — cannot resolve `./chrome.js`.

- [ ] **Step 3: Write `packages/chrome-setup/src/chrome.ts`**

```ts
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Browser, detectBrowserPlatform, install } from "@puppeteer/browsers";
import { PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

/** Pinned Chrome-for-Testing build used when downloading. */
export const DEFAULT_CHROME_BUILD = "144.0.7559.96";

type PlatformName = NodeJS.Platform | "linux" | "darwin" | "win32";

function executableNames(platform: PlatformName): string[] {
  if (platform === "win32") return ["chrome.exe"];
  if (platform === "darwin")
    return ["Google Chrome for Testing", "Chromium", "Google Chrome"];
  return ["chrome", "chromium"];
}

/** BFS a directory tree for a Chrome executable; descends macOS .app bundles. */
function findChromeExecutable(baseDir: string, platform: PlatformName): string | undefined {
  if (!existsSync(baseDir)) return undefined;
  const names = executableNames(platform);
  const queue: string[] = [baseDir];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith(".app")) {
          const macOS = join(full, "Contents", "MacOS");
          if (existsSync(macOS)) queue.unshift(macOS);
        } else {
          queue.push(full);
        }
      } else if (names.includes(entry.name)) {
        return full;
      }
    }
  }
  return undefined;
}

export interface ResolveChromeOptions {
  /** Directories to search (recursively). Default: `<cwd>/chrome-local`, the
   *  Puppeteer cache (`~/.cache/puppeteer`). */
  searchDirs?: string[];
  /**
   * Override the platform used for executable-NAME matching during
   * resolution (tests / cross-checking). Default: `process.platform`. Does
   * NOT affect `downloadChrome` (which auto-detects the current machine).
   */
  platform?: PlatformName;
}

function defaultSearchDirs(): string[] {
  return [join(process.cwd(), "chrome-local"), join(homedir(), ".cache", "puppeteer")];
}

/** Resolve an existing Chrome executable path, or `undefined`. Pure/sync. */
export function resolveChromePath(opts: ResolveChromeOptions = {}): string | undefined {
  const platform = opts.platform ?? (process.platform as PlatformName);
  const dirs = opts.searchDirs ?? defaultSearchDirs();
  for (const dir of dirs) {
    const found = findChromeExecutable(dir, platform);
    if (found) return found;
  }
  return undefined;
}

export interface DownloadChromeOptions extends LoggerOption {
  /** Chrome build id. Default: DEFAULT_CHROME_BUILD. */
  buildId?: string;
  /** Cache directory to install into. Default: `~/.cache/puppeteer`. */
  cacheDir?: string;
}

/** Download a Chrome build via `@puppeteer/browsers`. */
export async function downloadChrome(
  opts: DownloadChromeOptions = {},
): Promise<{ executablePath: string }> {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new PptrKitError("Could not detect a browser platform for download", {
      context: { phase: "detectBrowserPlatform" },
    });
  }
  const buildId = opts.buildId ?? DEFAULT_CHROME_BUILD;
  const cacheDir = opts.cacheDir ?? join(homedir(), ".cache", "puppeteer");
  opts.logger?.log(`Downloading Chrome ${buildId} (${platform})`, "step");
  let installed;
  try {
    installed = await install({ browser: Browser.CHROME, buildId, cacheDir, platform });
  } catch (err) {
    throw new PptrKitError(`Chrome download failed (${buildId}, ${platform})`, {
      cause: err,
      retryable: true,
      context: { buildId, platform },
    });
  }
  opts.logger?.log(`Chrome ready at ${installed.executablePath}`, "success");
  return { executablePath: installed.executablePath };
}

export type EnsureChromeOptions = ResolveChromeOptions & DownloadChromeOptions;

/** Resolve an existing Chrome; otherwise download one. Throws on failure. */
export async function ensureChrome(opts: EnsureChromeOptions = {}): Promise<string> {
  const existing = resolveChromePath(opts);
  if (existing) {
    opts.logger?.log(`Using resolved Chrome at ${existing}`, "info");
    return existing;
  }
  const { executablePath } = await downloadChrome(opts);
  if (!executablePath) {
    throw new PptrKitError("Chrome could not be resolved or downloaded", {
      context: { searchDirs: opts.searchDirs ?? defaultSearchDirs() },
    });
  }
  return executablePath;
}
```

- [ ] **Step 4: Run, confirm pass + typecheck**

Run: `pnpm --filter @technical-1/chrome-setup test` → PASS (7 tests).
Run: `pnpm --filter @technical-1/chrome-setup typecheck` → clean. `@types/node`
supplies `node:fs/os/path` + `NodeJS.Platform`; `@puppeteer/browsers` ships its
own types. If `readdirSync(..., { withFileTypes: true })` element typing trips
`noUncheckedIndexedAccess`, the `queue.shift() as string` cast handles the
queue; do not change behavior.

- [ ] **Step 5: Commit**

```bash
git add packages/chrome-setup/src/chrome.ts packages/chrome-setup/src/chrome.test.ts
git commit -m "feat(chrome-setup): resolve/download Chrome (ported & de-Electron'd from Kanfer)"
```

---

### Task 3: `@technical-1/chrome-setup` public surface + build

**Files:** Modify `packages/chrome-setup/src/index.ts`; Test
`packages/chrome-setup/src/index.test.ts`.

- [ ] **Step 1: Write failing test** `packages/chrome-setup/src/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as cs from "./index.js";

describe("public surface", () => {
  it("exposes the resolve/download/ensure fns + the build constant only", () => {
    expect(typeof cs.resolveChromePath).toBe("function");
    expect(typeof cs.downloadChrome).toBe("function");
    expect(typeof cs.ensureChrome).toBe("function");
    expect(typeof cs.DEFAULT_CHROME_BUILD).toBe("string");
    expect(Object.keys(cs).sort()).toEqual(
      ["DEFAULT_CHROME_BUILD", "downloadChrome", "ensureChrome", "resolveChromePath"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — `pnpm --filter @technical-1/chrome-setup test` → FAIL (exports undefined).

- [ ] **Step 3: Replace `packages/chrome-setup/src/index.ts`**

```ts
export {
  DEFAULT_CHROME_BUILD,
  resolveChromePath,
  downloadChrome,
  ensureChrome,
} from "./chrome.js";
export type {
  ResolveChromeOptions,
  DownloadChromeOptions,
  EnsureChromeOptions,
} from "./chrome.js";
```

- [ ] **Step 4: Run, confirm pass + build** — `pnpm --filter @technical-1/chrome-setup test` PASS (8 tests); `pnpm --filter @technical-1/chrome-setup typecheck && pnpm --filter @technical-1/chrome-setup build` clean.

- [ ] **Step 5: Verify dual-build artifacts** — `ls packages/chrome-setup/dist/index.js packages/chrome-setup/dist/index.cjs packages/chrome-setup/dist/index.d.ts packages/chrome-setup/dist/index.d.cts` → all four print.

- [ ] **Step 6: Commit**

```bash
git add packages/chrome-setup/src/index.ts packages/chrome-setup/src/index.test.ts
git commit -m "feat(chrome-setup): expose public surface; verify dual build"
```

---

### Task 4: `@technical-1/launcher` scaffold

**Files:** `packages/launcher/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts}`

- [ ] **Step 1: Create the 5 skeleton files** with `<pkg>`=`launcher`,
  `<description>`=`Launch options, headless toggle, and a guaranteed-cleanup browser pool`.
  In `package.json`, add BOTH a `dependencies` and a `peerDependencies` block
  (this is the suite's first peer — establishes the convention):

```json
  "dependencies": {
    "@technical-1/core": "workspace:*"
  },
  "peerDependencies": {
    "puppeteer-core": ">=22"
  },
  "devDependencies": {
    "puppeteer-core": "^24.4.0"
  }
```
  Rationale: `puppeteer-core` is a peer (consumer owns the version, spec §4.1);
  it is also a `devDependency` so this package can typecheck/test against its
  types locally. tsup auto-externalizes peer deps (never bundled).

- [ ] **Step 2: Create `packages/launcher/README.md`**

```markdown
# @technical-1/launcher

Launch a `puppeteer-core` browser with sane defaults and a headless toggle, run
work with guaranteed cleanup, and pool browsers for concurrency.
`puppeteer-core` is a **peer dependency** — you install and own its version;
you pass your `puppeteer` instance in (this package imports only its types).

```ts
import puppeteer from "puppeteer-core";
import { withBrowser } from "@technical-1/launcher";

await withBrowser(puppeteer, { executablePath }, async (browser) => {
  const page = await browser.newPage();
  // ...
});
```

`launch` / `withBrowser` (closes the browser in a `finally`, even on throw) /
`BrowserPool` (fixed-size, lazily created, `drain()` closes everything).
```

- [ ] **Step 3: Re-resolve workspace** — `pnpm install && pnpm -r list --depth -1` → succeeds; lists `@technical-1/launcher`; `@technical-1/core` workspace-linked; `puppeteer-core` present (dev + peer). `pnpm` may warn about the peer being satisfied by the devDependency — that is expected/fine.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(launcher): scaffold @technical-1/launcher (puppeteer-core peer)"
```

---

### Task 5: `@technical-1/launcher` implementation (TDD)

**Files:** Create `packages/launcher/src/launcher.ts`, `packages/launcher/src/pool.ts`;
Test `packages/launcher/src/launcher.test.ts`, `packages/launcher/src/pool.test.ts`.

Unit tests inject a **mock** puppeteer (`{ launch: vi.fn() }`) returning a mock
`Browser` (`{ close: vi.fn(), ... }`). No real Chrome, no network (spec §9).

- [ ] **Step 1: Write the failing tests**

`packages/launcher/src/launcher.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { launch, withBrowser } from "./launcher.js";

function mockPuppeteer() {
  const browser = { close: vi.fn().mockResolvedValue(undefined) };
  const puppeteer = { launch: vi.fn().mockResolvedValue(browser) };
  return { puppeteer, browser };
}

describe("launch", () => {
  it("passes executablePath, headless and merged sandbox args", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const result = await launch(puppeteer, { executablePath: "/c", headless: false, args: ["--foo"] });
    expect(result).toBe(browser);
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: "/c",
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--foo"],
      }),
    );
  });

  it("defaults to headless true", async () => {
    const { puppeteer } = mockPuppeteer();
    await launch(puppeteer, { executablePath: "/c" });
    expect(puppeteer.launch).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true }),
    );
  });
});

describe("withBrowser", () => {
  it("returns the callback result and closes the browser", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const out = await withBrowser(puppeteer, { executablePath: "/c" }, async () => "done");
    expect(out).toBe("done");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("closes the browser even when the callback throws, and rethrows", async () => {
    const { puppeteer, browser } = mockPuppeteer();
    const boom = new Error("boom");
    await expect(
      withBrowser(puppeteer, { executablePath: "/c" }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
```

`packages/launcher/src/pool.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { BrowserPool } from "./pool.js";

function mockPuppeteer() {
  let n = 0;
  const created: Array<{ id: number; close: ReturnType<typeof vi.fn> }> = [];
  const puppeteer = {
    launch: vi.fn(async () => {
      const b = { id: ++n, close: vi.fn().mockResolvedValue(undefined) };
      created.push(b);
      return b;
    }),
  };
  return { puppeteer, created };
}

describe("BrowserPool", () => {
  it("creates at most `size` browsers and reuses released ones", async () => {
    const { puppeteer } = mockPuppeteer();
    const pool = new BrowserPool(puppeteer, { executablePath: "/c" }, { size: 2 });
    const a = await pool.acquire();
    const b = await pool.acquire();
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    pool.release(a);
    const c = await pool.acquire();
    expect(c).toBe(a); // reused, not a 3rd launch
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
    await pool.drain();
  });

  it("queues acquire calls until a browser is released when at capacity", async () => {
    const { puppeteer } = mockPuppeteer();
    const pool = new BrowserPool(puppeteer, { executablePath: "/c" }, { size: 1 });
    const first = await pool.acquire();
    let got = false;
    const pending = pool.acquire().then((b) => {
      got = true;
      return b;
    });
    await Promise.resolve();
    expect(got).toBe(false); // still waiting — pool is at capacity
    pool.release(first);
    const second = await pending;
    expect(got).toBe(true);
    expect(second).toBe(first);
    await pool.drain();
  });

  it("drain() closes every created browser", async () => {
    const { puppeteer, created } = mockPuppeteer();
    const pool = new BrowserPool(puppeteer, { executablePath: "/c" }, { size: 2 });
    const a = await pool.acquire();
    const b = await pool.acquire();
    pool.release(a);
    await pool.drain();
    expect(created).toHaveLength(2);
    for (const br of created) expect(br.close).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, confirm failure** — `pnpm --filter @technical-1/launcher test` → FAIL (cannot resolve `./launcher.js` / `./pool.js`).

- [ ] **Step 3: Write the implementations**

`packages/launcher/src/launcher.ts`:

```ts
import type { Browser, PuppeteerNode } from "puppeteer-core";
import type { LoggerOption } from "@technical-1/core";

/** Minimal injected puppeteer surface — just what launch needs. */
export type PuppeteerLike = Pick<PuppeteerNode, "launch">;

export interface LaunchOptions extends LoggerOption {
  /** Chrome executable path (from @technical-1/chrome-setup). */
  executablePath: string;
  /** Headless mode. Default true. */
  headless?: boolean;
  /** Extra Chrome args, appended after the sandbox defaults. */
  args?: string[];
}

const SANDBOX_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

/** Launch a browser with sane defaults. The caller injects `puppeteer`. */
export async function launch(
  puppeteer: PuppeteerLike,
  opts: LaunchOptions,
): Promise<Browser> {
  const headless = opts.headless ?? true;
  opts.logger?.log(`Launching Chrome (${headless ? "headless" : "headed"})`, "step");
  return puppeteer.launch({
    executablePath: opts.executablePath,
    headless,
    args: [...SANDBOX_ARGS, ...(opts.args ?? [])],
  });
}

/**
 * Launch a browser, run `fn`, and ALWAYS close the browser in a `finally`
 * (spec §8 — a thrown error never leaks a browser process).
 */
export async function withBrowser<T>(
  puppeteer: PuppeteerLike,
  opts: LaunchOptions,
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const browser = await launch(puppeteer, opts);
  try {
    return await fn(browser);
  } finally {
    await browser.close();
    opts.logger?.log("Browser closed", "info");
  }
}
```

`packages/launcher/src/pool.ts`:

```ts
import type { Browser } from "puppeteer-core";
import { launch, type LaunchOptions, type PuppeteerLike } from "./launcher.js";

export interface PoolOptions {
  /** Maximum concurrent browsers. Default 1. */
  size?: number;
}

/**
 * Fixed-size pool of lazily-launched browsers. `acquire()` reuses an idle
 * browser, launches a new one up to `size`, or waits for a `release()`.
 * `drain()` closes every browser the pool created.
 */
export class BrowserPool {
  readonly #puppeteer: PuppeteerLike;
  readonly #opts: LaunchOptions;
  readonly #size: number;
  readonly #idle: Browser[] = [];
  readonly #all = new Set<Browser>();
  readonly #waiters: Array<(b: Browser) => void> = [];

  constructor(puppeteer: PuppeteerLike, opts: LaunchOptions, poolOpts: PoolOptions = {}) {
    this.#puppeteer = puppeteer;
    this.#opts = opts;
    this.#size = poolOpts.size ?? 1;
  }

  async acquire(): Promise<Browser> {
    const idle = this.#idle.pop();
    if (idle) return idle;
    if (this.#all.size < this.#size) {
      const browser = await launch(this.#puppeteer, this.#opts);
      this.#all.add(browser);
      return browser;
    }
    return new Promise<Browser>((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  release(browser: Browser): void {
    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter(browser);
      return;
    }
    this.#idle.push(browser);
  }

  async drain(): Promise<void> {
    const all = [...this.#all];
    this.#all.clear();
    this.#idle.length = 0;
    this.#waiters.length = 0;
    await Promise.all(all.map((b) => b.close()));
  }
}
```

- [ ] **Step 4: Run, confirm pass + typecheck**

Run: `pnpm --filter @technical-1/launcher test` → PASS (7 tests), no noise.
Run: `pnpm --filter @technical-1/launcher typecheck` → clean. `import type`
keeps `puppeteer-core` type-only (verbatimModuleSyntax); private `#fields`
satisfy strict. The mock browsers in tests are structurally typed against
`Browser` only through the public methods used — if a mock literal trips a
`Browser` assignment, the tests pass the mock positionally to a
`PuppeteerLike` whose `launch` returns `Browser`; cast the mock launch result
via `as unknown as Browser` ONLY inside the test mock factory if strictly
required, never in `src/`.

- [ ] **Step 5: Commit**

```bash
git add packages/launcher/src/launcher.ts packages/launcher/src/pool.ts packages/launcher/src/launcher.test.ts packages/launcher/src/pool.test.ts
git commit -m "feat(launcher): launch + withBrowser (finally-close) + BrowserPool"
```

---

### Task 6: `@technical-1/launcher` public surface + build

**Files:** Modify `packages/launcher/src/index.ts`; Test `packages/launcher/src/index.test.ts`.

- [ ] **Step 1: Write failing test** `packages/launcher/src/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import * as launcher from "./index.js";

describe("public surface", () => {
  it("exposes launch, withBrowser and BrowserPool only", () => {
    expect(typeof launcher.launch).toBe("function");
    expect(typeof launcher.withBrowser).toBe("function");
    expect(typeof launcher.BrowserPool).toBe("function");
    expect(Object.keys(launcher).sort()).toEqual(
      ["BrowserPool", "launch", "withBrowser"].sort(),
    );
  });
});
```

- [ ] **Step 2: Run, confirm failure** — FAIL (exports undefined).

- [ ] **Step 3: Replace `packages/launcher/src/index.ts`**

```ts
export { launch, withBrowser } from "./launcher.js";
export type { LaunchOptions, PuppeteerLike } from "./launcher.js";
export { BrowserPool } from "./pool.js";
export type { PoolOptions } from "./pool.js";
```

- [ ] **Step 4: Run, confirm pass + build** — `pnpm --filter @technical-1/launcher test` PASS (8 tests); `pnpm --filter @technical-1/launcher typecheck && pnpm --filter @technical-1/launcher build` clean.

- [ ] **Step 5: Verify dual-build artifacts** — `ls packages/launcher/dist/index.js packages/launcher/dist/index.cjs packages/launcher/dist/index.d.ts packages/launcher/dist/index.d.cts` → all four print.

- [ ] **Step 6: Commit**

```bash
git add packages/launcher/src/index.ts packages/launcher/src/index.test.ts
git commit -m "feat(launcher): expose public surface; verify dual build"
```

---

### Task 7: Changesets + whole-monorepo CI gate

**Files:** Create `.changeset/browser-foundation.md`.

- [ ] **Step 1: Create `.changeset/browser-foundation.md`**

```markdown
---
"@technical-1/chrome-setup": minor
"@technical-1/launcher": minor
---

Browser foundation: `chrome-setup` resolves or downloads a Chrome build;
`launcher` provides `launch`/`withBrowser` (guaranteed cleanup) and a
fixed-size `BrowserPool`. `puppeteer-core` is a peer dependency of `launcher`.
```

- [ ] **Step 2: Whole-monorepo CI gate**

Run: `pnpm install && pnpm run ci`
Expected: all 6 packages green (`core`, `retry`, `logger`, `config`,
`chrome-setup`, `launcher`). Capture the turbo summary + per-package test
counts (core 13, retry 10, logger 7, config 9, chrome-setup 12, launcher 8 =
59 — chrome-setup grew from code-review hardening: macOS .app descent,
first-dir-wins, logger, platform-undetected, retryable-install-error tests).
Run: `pnpm run lint` → ZERO warnings/errors monorepo-wide.

- [ ] **Step 3: Invariant sweep**

Run: `grep -rn "autom8ops" packages/ docs/ .changeset/ .github/ 2>/dev/null | grep -v node_modules || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add .changeset/browser-foundation.md
git commit -m "chore: changeset for the browser foundation (chrome-setup, launcher)"
```

---

## Self-Review

**Spec coverage (this slice):**
- §5: `chrome-setup` (download/resolve Chrome, dep `@puppeteer/browsers`) ✓
  Tasks 1–3; `launcher` (launch options, headless toggle, browser pool, peer
  `puppeteer-core`) ✓ Tasks 4–6.
- §4.1: `puppeteer-core` is a `peerDependency` on `launcher` ✓;
  `chrome-setup` additionally depends on `@puppeteer/browsers` and has no peer
  ✓ (the documented exception).
- §4.2: acyclic — both depend only on `core` (+ `chrome-setup` on the external
  `@puppeteer/browsers`); no capability cross-dep ✓.
- §4.3: DI logging via `LoggerOption` (`downloadChrome`/`launch`/`withBrowser`)
  ✓.
- §4.4: function-first (`resolveChromePath`/`downloadChrome`/`ensureChrome`/
  `launch`/`withBrowser`); `BrowserPool` is a class because pool state is
  intrinsic ✓.
- §4.5: canonical exports/tsup/vitest/README/sideEffects:false ✓.
- §4.6/§8: `chrome-setup` throws core `PptrKitError` with `context`;
  `launcher.withBrowser` closes in `finally` so a throw never leaks a browser
  ✓ (tested).
- §9: every export unit-tested; path resolution uses a real temp dir,
  download is `vi.mock`'d, browsers are mocks — no real Chrome, no network ✓.
- §12: no bundled credentials; no live internet ✓.
- Roadmap conventions honored: canonical exports map, per-package vitest
  config, root @types/node (no DOM/lib override), no dead eslint-disable,
  property/`context` error usage, peer auto-externalized by tsup ✓.

**New conventions this plan establishes (add to roadmap during execution):**
peer `puppeteer-core` + devDependency + type-only import + DI-mockable launcher;
the `@puppeteer/browsers` real-dependency exception; `chrome-setup` is
environment-agnostic (Electron packaged-resource resolution deferred to the
template, Plan 10).

**Placeholder scan:** each package ships `export {}` in its scaffold task,
fully replaced in its surface task (3/6). Skeleton written once and referenced
with full content. No TBD/"similar to Task N".

**Type consistency:** `LaunchOptions`/`PuppeteerLike`/`PoolOptions`/
`ResolveChromeOptions`/`DownloadChromeOptions`/`EnsureChromeOptions`/
`DEFAULT_CHROME_BUILD` defined in impl tasks and re-exported with identical
names + asserted by the exact-`Object.keys` barrel tests (Tasks 3, 6).
`launch`/`withBrowser`/`BrowserPool`/`resolveChromePath`/`downloadChrome`/
`ensureChrome` names consistent across impl, index, README, tests.
