# Plan 09: Examples + Integration + Release Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 19 capability + utility packages of `@technical-1/*` **publishable**. Adds (1) a single `examples/` workspace with one demo per published package, (2) a `tests/integration/` tier gated by `PPTR_IT=1` that exercises capability packages against a local static fixture HTTP server (no live internet), (3) the `release.yml` Changesets publish pipeline, and (4) discharges the publish-blocking deferred items tracked in the roadmap (sourcemap dedup, SHA-pinned actions, `workspace:^` internal-dep range, `@types/node` consumer note, changeset-status CI guard, npm org confirmation checklist).

**Architecture:** No new published packages. New non-published workspace `examples/` (single package with one demo file per capability). New non-workspace `tests/integration/` directory (its own `vitest.config.ts`, gated by `PPTR_IT=1`, never runs in the default `pnpm test`). New `.github/workflows/release.yml` using `changesets/action@v1`.

**Tech Stack:** Unchanged from Plans 01-08 (TypeScript NodeNext + strict + verbatim, pnpm workspaces, Turborepo, Changesets, tsup, vitest, eslint flat config). New deps: `@changesets/action` (CI-only), node's built-in `http`/`fs` for the fixture server, no new runtime deps.

**Out of scope (deferred to Plan 10 — pre-1.0 surface review):**
- `fingerprint` realism follow-ups (UA-version sync from chrome-setup, in-page navigator.language override, geographic-correlated random)
- `navigation.goto` return-type pre-1.0 consideration (`void` vs `HTTPResponse | null`)
- Pre-1.0 selective re-exports (`PlatformName`, `RetryOptions`, etc.)
- PDF margin shallow-merge improved API
- Roadmap Plan 10 owns these.

---

## Spec coverage

From spec §5: "Plus a non-published `examples/` directory: one tiny runnable demo per package." — Plan 09 owns this.

From spec §9: Unit tier (every package) + Integration tier (every capability package) gated by `PPTR_IT=1`. Plan 09 wires the integration tier and its CI job.

From spec §10:
- pnpm workspaces, `workspace:*` rewritten to real ranges on publish — Plan 09 confirms the rewrite shape (`workspace:^`).
- Turborepo pipeline — already in place from Plan 01.
- Changesets — Plan 09 ships `release.yml`.
- `ci.yml` integration job — Plan 09 adds it.
- `release.yml` — Plan 09 creates it.

From spec §12: no live-internet tests — Plan 09's integration server is `localhost`-only.

From spec §3 / §11: invariants unchanged.

## Deferred items being discharged (from roadmap "Known issues" and "Plan 09 release decisions")

1. **Duplicate `//# sourceMappingURL`** in tsup output — fix via a `tsup.config.base.ts` `onSuccess` hook that runs a small post-build dedup script.
2. **SHA-pin GitHub Actions** — convert `@v4` floats to immutable commit SHAs via a vetted tool (`pinact` or `pin-github-action`), applied to both `ci.yml` and the new `release.yml`. Document the unpinning process.
3. **`workspace:*` → `workspace:^`** — change the internal-dep range so a `core` patch ships transparently. Document in `.changeset/config.json`.
4. **`@types/node` consumer requirement** — add a "Requirements" note to every package's `README.md` and a `peerDependencies` entry where appropriate (packages whose emitted `.d.ts` reference Node types).
5. **CI changeset-status guard** — add `pnpm changeset status --since=origin/main` as a CI step that fails when a non-doc PR lacks a changeset.
6. **npm org / scope confirmation** — checklist item in `release.yml` body that BEFORE first execution, the `@technical-1` scope exists and `NPM_TOKEN` has publish access (the human must verify; the workflow is informational only).
7. **CI install/build duplication** — `ci.yml`'s `build` and `integration` jobs share artifacts via `upload-artifact`/`download-artifact` on `dist/`.

## File structure

```
.changeset/
  config.json                     # set updateInternalDependencies / range = "^"
.github/workflows/
  ci.yml                          # MODIFIED: add integration job, SHA-pin, changeset-status guard
  release.yml                     # NEW: changesets/action@v1 publish workflow
examples/
  package.json                    # NEW: single non-published package, depends on all @technical-1/*
  tsconfig.json
  src/
    core.example.ts               # error catching demo
    retry.example.ts
    logger.example.ts
    config.example.ts
    chrome-setup.example.ts
    launcher.example.ts
    navigation.example.ts
    interaction-helpers.example.ts
    extract.example.ts
    stealth.example.ts
    fingerprint.example.ts
    human.example.ts
    proxy.example.ts
    session.example.ts
    network.example.ts
    screenshots.example.ts
    pdf.example.ts
    downloads.example.ts
    captcha.example.ts
  README.md
tests/integration/
  package.json                    # NEW: non-workspace dev-only (or workspace; see T4 decision)
  vitest.config.ts                # gated by PPTR_IT=1
  fixtures/                       # static HTML for the fixture server
    index.html
    selector-page.html
    download-link.html
  server.ts                       # tiny http.createServer wrapping fixtures/
  src/
    launcher.integration.test.ts
    navigation.integration.test.ts
    interaction-helpers.integration.test.ts
    extract.integration.test.ts
    screenshots.integration.test.ts
    pdf.integration.test.ts
    downloads.integration.test.ts
    session.integration.test.ts
    network.integration.test.ts
    # (non-browser packages — retry, logger, config — have no integration counterpart; unit tier suffices)
scripts/
  dedup-sourcemap.js              # NEW: post-build sourcemap-comment dedup
  pin-actions.md                  # NEW: human-runnable checklist for SHA-pinning
tsup.config.base.ts                # MODIFIED: onSuccess hook → scripts/dedup-sourcemap.js
pnpm-workspace.yaml               # MODIFIED: include examples + tests/integration
```

## v1 limitations (documented; not deferred — these are intentional cuts)

- **Integration tests use a fixture HTTP server**, never real internet (spec §12). The server returns deterministic HTML for a small set of paths. Real-world scenarios (e.g. a specific bot-blocker firing) are not testable in v1.
- **Examples are typecheck-only by default** — they compile against the public surface (catching API drift) but only run end-to-end via the integration tier when `PPTR_IT=1`. This keeps `pnpm test` fast.
- **`release.yml` publishes to npm public** (`--access public` per scoped package convention). Private/restricted publish is a later opt-in.

## Tasks

### Task 1: Plan 09 prerequisites — internal-dep range + changeset config

**Files:**
- Modify: `.changeset/config.json`

The repo's `.changeset/config.json` currently has `updateInternalDependencies: "patch"` (from Plan 01). Since every package on this branch already has its own changeset, that field has been inert. Switching to `workspace:^` means a consumer can pick up a `core` patch without us bumping every dependent. This is the recommended Changesets shape for independently-versioned monorepos.

- [ ] **Step 1: Read `.changeset/config.json`** and inspect the current `updateInternalDependencies` value.

- [ ] **Step 2: Update `.changeset/config.json`** — set `"updateInternalDependencies": "minor"` (so dependents get bumped on a feature add to core, not just on patch — closer to semver intent) and leave the rest unchanged. Document the choice inline:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "minor",
  "ignore": ["examples", "@technical-1/integration-tests"]
}
```

Note: `examples` and `@technical-1/integration-tests` (T4) MUST be in `ignore` — they are non-published.

- [ ] **Step 3: Update every workspace package's internal `@technical-1/core` dep** from `"@technical-1/core": "workspace:*"` to `"@technical-1/core": "workspace:^"`. Same for any internal cross-package deps (e.g. `navigation` → `retry`, `human` → `retry` if applicable). Run a sweep:

```bash
grep -rn 'workspace:\*' packages/ | grep -v node_modules
```

Should return zero matches after the sweep. Use a targeted `sed -i '' 's/workspace:\*/workspace:^/g'` on each affected `package.json` (verify each diff before committing — never mass-edit without inspection).

- [ ] **Step 4: `pnpm install`** to re-resolve the workspace graph with the new range.

- [ ] **Step 5: Verify `pnpm turbo run lint test build` still 57/57 green.**

- [ ] **Step 6: Commit**

```bash
git add .changeset/config.json packages/*/package.json pnpm-lock.yaml
git commit -m "chore: shift internal deps to workspace:^ and updateInternalDependencies to minor (P9T1)"
```

---

### Task 2: Sourcemap dedup — `scripts/dedup-sourcemap.js` + `tsup.config.base.ts` `onSuccess`

**Files:**
- Create: `scripts/dedup-sourcemap.js`
- Modify: `tsup.config.base.ts`

tsup 8.5.1 emits the `//# sourceMappingURL=...` directive twice in every `dist/index.js` and `dist/index.cjs`. Harmless in dev (bundlers and Node both resolve correctly), but `npm pack` includes them as-is — a publish-time gripe. The dedup is a one-liner per file. Run it from `tsup.config.base.ts`'s `onSuccess` hook so every package picks it up via the shared base config.

- [ ] **Step 1: Write the failing test for the dedup script**

Create `scripts/dedup-sourcemap.test.js` (ESM, in scripts/ for local script-level tests):

```js
import { describe, it, expect } from "vitest";
import { dedupSourcemapComment } from "./dedup-sourcemap.js";

describe("dedupSourcemapComment", () => {
  it("removes duplicate trailing sourceMappingURL comments", () => {
    const input = `console.log(1);
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
`;
    const expected = `console.log(1);
//# sourceMappingURL=index.js.map
`;
    expect(dedupSourcemapComment(input)).toBe(expected);
  });

  it("leaves a single sourceMappingURL alone", () => {
    const input = `console.log(1);
//# sourceMappingURL=index.js.map
`;
    expect(dedupSourcemapComment(input)).toBe(input);
  });

  it("leaves files without sourceMappingURL alone", () => {
    const input = `console.log(1);\n`;
    expect(dedupSourcemapComment(input)).toBe(input);
  });
});
```

Also create a root `vitest.config.ts` workspace config that picks up `scripts/*.test.js` if not already (already configured per the cemented per-package vitest pattern from Plan 06 — verify the workspace-level vitest config in `vitest.config.ts` includes `scripts/**/*.test.{js,ts}`).

- [ ] **Step 2: Run → FAIL** with module-not-found.

- [ ] **Step 3: Create `scripts/dedup-sourcemap.js`**

```js
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Collapse runs of identical `//# sourceMappingURL=...` lines to a single
 * occurrence. tsup 8.5.x emits the directive twice; this normalizes the
 * output for `npm pack`. Idempotent.
 */
export function dedupSourcemapComment(text) {
  // Match contiguous duplicate sourceMappingURL lines and keep one.
  // The regex captures: line-start, the comment, optional newline + same comment.
  return text.replace(
    /^(\/\/# sourceMappingURL=.+)\r?\n\1(\r?\n|$)/gm,
    "$1$2",
  );
}

/** Apply the dedup to every `index.{js,cjs}` under the given dist directory. */
export async function dedupInDist(distDir) {
  const entries = await readdir(distDir);
  for (const name of entries) {
    if (!name.endsWith(".js") && !name.endsWith(".cjs")) continue;
    const path = join(distDir, name);
    const s = await stat(path);
    if (!s.isFile()) continue;
    const text = await readFile(path, "utf8");
    const out = dedupSourcemapComment(text);
    if (out !== text) await writeFile(path, out, "utf8");
  }
}

// CLI entry — called from tsup's onSuccess hook with the package's dist dir.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (typeof dir !== "string") {
    console.error("usage: dedup-sourcemap.js <distDir>");
    process.exit(2);
  }
  dedupInDist(dir).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run → 3 tests PASS**

- [ ] **Step 5: Modify `tsup.config.base.ts`** to add `onSuccess` that invokes the dedup:

```ts
import { defineConfig, type Options } from "tsup";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { dedupInDist } from "./scripts/dedup-sourcemap.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function baseTsup(extra: Partial<Options> = {}): Options {
  return {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    target: "es2022",
    onSuccess: async () => {
      // Best-effort: tsup runs onSuccess once after a successful build.
      // `cwd` for tsup is the package being built, so dist/ is package-local.
      await dedupInDist(resolve(process.cwd(), "dist"));
    },
    ...extra,
  };
}

export default defineConfig(baseTsup());
```

- [ ] **Step 6: Verify** — `pnpm turbo run build` rebuilds all 19 packages; every `dist/index.js` and `dist/index.cjs` has ONE `sourceMappingURL` line (was 2). Spot-check 3 packages with `grep -c sourceMappingURL packages/{core,launcher,captcha}/dist/index.cjs` — each should print `1`.

- [ ] **Step 7: Commit**

```bash
git add scripts/dedup-sourcemap.js scripts/dedup-sourcemap.test.js tsup.config.base.ts
git commit -m "build: dedup tsup's duplicate sourceMappingURL via onSuccess hook (P9T2)"
```

---

### Task 3: Examples workspace — scaffold + non-browser examples

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `examples/{package.json,tsconfig.json,README.md}`
- Create: `examples/src/{core,retry,logger,config}.example.ts`

The `examples/` workspace is a single non-published package. Each `*.example.ts` file is a small runnable script. Examples are typecheck-gated (compile-time API drift catcher) and runnable manually (`pnpm tsx examples/src/<name>.example.ts`), but NOT executed in the default `pnpm test`.

- [ ] **Step 1: Update `pnpm-workspace.yaml`** to include `examples`. The current entry from Plan 01 already includes it as inert — verify:

```yaml
packages:
  - 'packages/*'
  - 'examples'
```

If `examples` is already there, no edit needed. Otherwise add it.

- [ ] **Step 2: Create `examples/package.json`**

```json
{
  "name": "@technical-1/examples",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "@technical-1/captcha": "workspace:^",
    "@technical-1/chrome-setup": "workspace:^",
    "@technical-1/config": "workspace:^",
    "@technical-1/core": "workspace:^",
    "@technical-1/downloads": "workspace:^",
    "@technical-1/extract": "workspace:^",
    "@technical-1/fingerprint": "workspace:^",
    "@technical-1/human": "workspace:^",
    "@technical-1/interaction-helpers": "workspace:^",
    "@technical-1/launcher": "workspace:^",
    "@technical-1/logger": "workspace:^",
    "@technical-1/navigation": "workspace:^",
    "@technical-1/network": "workspace:^",
    "@technical-1/pdf": "workspace:^",
    "@technical-1/proxy": "workspace:^",
    "@technical-1/retry": "workspace:^",
    "@technical-1/screenshots": "workspace:^",
    "@technical-1/session": "workspace:^",
    "@technical-1/stealth": "workspace:^"
  },
  "devDependencies": {
    "puppeteer-core": "^24.4.0"
  }
}
```

`private: true` keeps it out of `changeset publish`. The workspace-internal deps use `workspace:^` consistent with P9T1.

- [ ] **Step 3: Create `examples/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create `examples/README.md`**

```markdown
# @technical-1/examples

One runnable demo per published package. Not published to npm. Typecheck-gated
by CI; manually runnable via `pnpm tsx examples/src/<name>.example.ts`.

Real-Chrome examples (anything in `examples/src/*-integration.example.ts`)
require `PPTR_IT=1` and run only on demand.

These exist primarily as API-drift detectors — if a published package's
public surface changes in a breaking way, the corresponding example fails to
typecheck, surfacing the breakage in CI.
```

- [ ] **Step 5: Create the 4 non-browser examples** (each ~15-25 lines):

`examples/src/core.example.ts`:
```ts
import { PptrKitError, SessionError, NavigationError } from "@technical-1/core";

const err = new NavigationError("https://example.com", { cause: new Error("net") });
console.log(err.name, err.retryable, err.url);

try {
  throw new SessionError("snapshot missing");
} catch (e) {
  if (e instanceof PptrKitError) console.log(e.name, e.retryable, e.context);
}
```

`examples/src/retry.example.ts`:
```ts
import { withRetry, sleep } from "@technical-1/retry";

let attempts = 0;
const result = await withRetry(
  async () => {
    attempts++;
    if (attempts < 3) throw Object.assign(new Error("transient"), { retryable: true });
    return "ok";
  },
  { maxRetries: 5, initialDelayMs: 50 },
);
console.log(result, "after", attempts, "attempts");

await sleep(10);
```

`examples/src/logger.example.ts`:
```ts
import { createConsoleLogger, createEventLogger } from "@technical-1/logger";

const console_ = createConsoleLogger();
console_.log("hello from console logger", "info");

const ev = createEventLogger();
ev.on("log", entry => console.log("ev:", entry.level, entry.message));
ev.log("hello from event logger");
```

`examples/src/config.example.ts`:
```ts
import { loadConfig } from "@technical-1/config";

const cfg = loadConfig(
  { url: { env: "TARGET_URL", default: "https://example.com" }, headless: { env: "HEADLESS", default: true, type: "boolean" } },
  { env: { TARGET_URL: "https://kanfer.dev", HEADLESS: "false" } },
);
console.log(cfg.url, cfg.headless);
```

(Adapt each based on the actual public API of the package — refer to each package's `src/index.ts` for the canonical export shape if any of the above don't match.)

- [ ] **Step 6: `pnpm install`** to wire the workspace.

- [ ] **Step 7: `pnpm --filter @technical-1/examples typecheck`** → must be green.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml examples/ pnpm-lock.yaml
git commit -m "feat(examples): workspace scaffold + non-browser tier examples (core, retry, logger, config) (P9T3)"
```

---

### Task 4: Examples — browser-driving tier (chrome-setup through proxy)

**Files:**
- Create: `examples/src/{chrome-setup,launcher,navigation,interaction-helpers,extract,stealth,fingerprint,human,proxy}.example.ts`

Each example is a small typecheck-only program demonstrating the package's primary API. Examples import `puppeteer-core` from the devDep (it's hoisted up) — but they DO NOT need to run real Chrome to typecheck.

(Each file is ~15-25 lines, illustrating the canonical API. Refer to each `packages/<name>/src/index.ts` and `README.md` for the surface to demo.)

- [ ] **Step 1-9: Create the 9 examples** — `chrome-setup`, `launcher`, `navigation`, `interaction-helpers`, `extract`, `stealth`, `fingerprint`, `human`, `proxy`. Each should:
  - Import only public surface (`from "@technical-1/<pkg>"`).
  - Be self-contained (top-level await, ESM).
  - Use a `// @ts-expect-error` ONLY if the example demonstrates an error-path call that's intentionally invalid.

(Concrete code blocks for each example are not enumerated here — the implementer writes them based on the package's actual surface. If any package's surface differs from the implementer's expectation, the typecheck fails and the implementer adapts.)

- [ ] **Step 10: Verify** — `pnpm --filter @technical-1/examples typecheck` green (now exercises 13 examples).

- [ ] **Step 11: Commit**

```bash
git add examples/src/
git commit -m "feat(examples): browser-driving tier examples (chrome-setup, launcher, navigation, interaction-helpers, extract, stealth, fingerprint, human, proxy) (P9T4)"
```

---

### Task 5: Examples — state/output/captcha tier (6 packages)

**Files:**
- Create: `examples/src/{session,network,screenshots,pdf,downloads,captcha}.example.ts`

- [ ] **Step 1-6: Create the 6 examples** — `session`, `network`, `screenshots`, `pdf`, `downloads`, `captcha`.

- [ ] **Step 7: Verify** — `pnpm --filter @technical-1/examples typecheck` green (now 19 examples).

- [ ] **Step 8: Commit** — `feat(examples): state/output/captcha tier examples (P9T5)`

---

### Task 6: Integration tier — fixture server + scaffold

**Files:**
- Create: `tests/integration/{package.json,tsconfig.json,vitest.config.ts,README.md}`
- Create: `tests/integration/fixtures/{index,form,download-link}.html`
- Create: `tests/integration/src/server.ts`
- Create: `tests/integration/src/server.test.ts`

The integration tier is a new non-published workspace package (so it has access to all `@technical-1/*` via `workspace:^`). Its tests run only when `PPTR_IT=1`. Tests use real Chrome (downloaded via `chrome-setup`) against a tiny local HTTP server.

- [ ] **Step 1: Create `tests/integration/package.json`**

```json
{
  "name": "@technical-1/integration-tests",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@technical-1/launcher": "workspace:^",
    "@technical-1/chrome-setup": "workspace:^",
    "@technical-1/navigation": "workspace:^",
    "@technical-1/interaction-helpers": "workspace:^",
    "@technical-1/extract": "workspace:^",
    "@technical-1/screenshots": "workspace:^",
    "@technical-1/pdf": "workspace:^",
    "@technical-1/downloads": "workspace:^",
    "@technical-1/session": "workspace:^",
    "@technical-1/network": "workspace:^"
  },
  "devDependencies": {
    "puppeteer-core": "^24.4.0"
  }
}
```

- [ ] **Step 2: Update `pnpm-workspace.yaml`** to include `tests/integration`.

- [ ] **Step 3: Create `tests/integration/tsconfig.json`** + `tsup.config.ts` (none needed — no build) + `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Integration tier is gated: in default `pnpm test` runs (PPTR_IT unset),
    // these tests are SKIPPED. CI sets PPTR_IT=1 in the integration job only.
    testTimeout: 60_000,
  },
});
```

Add a top-level `beforeAll` or `describe.skipIf` in each test file:
```ts
const PPTR_IT = process.env.PPTR_IT === "1";
describe.skipIf(!PPTR_IT)("...", () => { ... });
```

- [ ] **Step 4: Create `tests/integration/fixtures/index.html`** — minimal page with a heading, a link, and a `<button id="trigger">`.

- [ ] **Step 5: Create `tests/integration/fixtures/form.html`** — page with a text input and a submit button (for `interaction-helpers` tests).

- [ ] **Step 6: Create `tests/integration/fixtures/download-link.html`** — page with an `<a href="/download/sample.bin" download>` link (for `downloads` tests). The server serves `sample.bin` as a 1KB binary blob with `Content-Disposition: attachment`.

- [ ] **Step 7: Create `tests/integration/src/server.ts`**

A tiny `http.createServer` that serves files from `fixtures/` and synthesizes the `/download/sample.bin` response. Exposes `startServer(port?): Promise<{ port: number; close: () => Promise<void> }>`. Default port `0` (OS-assigned, race-free for parallel tests).

```ts
import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "..", "fixtures");

export interface FixtureServer {
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startServer(port: number = 0): Promise<FixtureServer> {
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/download/sample.bin") {
        const body = Buffer.alloc(1024, 0x41); // 1 KB of 'A'
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="sample.bin"',
          "Content-Length": String(body.length),
        });
        res.end(body);
        return;
      }
      // Strip leading slash; default to index.html
      const fileName = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const filePath = join(FIXTURES, fileName);
      const data = await readFile(filePath);
      const ext = fileName.split(".").pop();
      const type = ext === "html" ? "text/html; charset=utf-8" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type, "Content-Length": String(data.length) });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${(err as Error).message}`);
    }
  });

  await new Promise<void>(resolve => server.listen(port, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("server.address() returned unexpected shape");
  const actualPort = addr.port;
  return {
    port: actualPort,
    baseUrl: `http://127.0.0.1:${actualPort}`,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}
```

- [ ] **Step 8: Create `tests/integration/src/server.test.ts`** — a unit-tier test of the server itself (does NOT require PPTR_IT=1):

```ts
import { describe, it, expect } from "vitest";
import { startServer } from "./server.js";

describe("fixture server", () => {
  it("serves index.html on /", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("<html"); // smoke
    await s.close();
  });

  it("serves /download/sample.bin as attachment", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/download/sample.bin`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-length")).toBe("1024");
    await s.close();
  });

  it("404s unknown paths", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/missing.html`);
    expect(res.status).toBe(404);
    await s.close();
  });
});
```

- [ ] **Step 9: Run `pnpm install` + verify** — `pnpm --filter @technical-1/integration-tests test` → 3 server tests pass (these run in default `pnpm test` because they don't gate on `PPTR_IT`).

- [ ] **Step 10: Commit** — `feat(integration): fixture server + scaffold (P9T6)`

---

### Task 7: Integration tests — capability packages (gated by `PPTR_IT=1`)

**Files:**
- Create: 9 integration test files in `tests/integration/src/<pkg>.integration.test.ts`

Each test:
- `describe.skipIf(process.env.PPTR_IT !== "1")(...)` — gated.
- `beforeAll`: `ensureChrome()` + `startServer()` + `launchBrowser()`.
- `afterAll`: close browser + close server.
- Per `it`: real Chrome navigates to a fixture URL and exercises the capability against the real DOM.

(Concrete code for each integration test is implementer-authored against the actual API. The shape is uniform — 9 files, ~30 lines each.)

- [ ] **Step 1: Write `tests/integration/src/launcher.integration.test.ts`** — `withBrowser` opens a real Chrome, runs a no-op closure, closes cleanly.

- [ ] **Step 2: Write `tests/integration/src/navigation.integration.test.ts`** — `goto(page, fixtureUrl)` succeeds; retry-on-failure on a deliberately-bad URL throws `NavigationError`.

- [ ] **Step 3: Write `tests/integration/src/interaction-helpers.integration.test.ts`** — `safeClick`, `safeType`, `waitAndGet` exercise the form fixture.

- [ ] **Step 4: Write `tests/integration/src/extract.integration.test.ts`** — `extractText`/`extractAll` on the index page.

- [ ] **Step 5: Write `tests/integration/src/screenshots.integration.test.ts`** — `screenshot(page, { fullPage: true })` returns a non-empty Buffer.

- [ ] **Step 6: Write `tests/integration/src/pdf.integration.test.ts`** — `pageToPdf(page)` returns a non-empty Buffer starting with the `%PDF-` magic bytes.

- [ ] **Step 7: Write `tests/integration/src/downloads.integration.test.ts`** — `enableDownloads(browser, tmpDir)` + `awaitDownload(tmpDir, async () => page.click("a[download]"))` returns `{ filename: "sample.bin", size: 1024 }`.

- [ ] **Step 8: Write `tests/integration/src/session.integration.test.ts`** — `captureSession(page)` after some cookie/storage mutation, `restoreSession(otherPage, snap)`, navigate, verify state restored.

- [ ] **Step 9: Write `tests/integration/src/network.integration.test.ts`** — `blockResources` aborts an image request fired by the fixture page; `captureResponses` records the document response.

- [ ] **Step 10: Verify default `pnpm test`** still passes (these tests skip because `PPTR_IT` is unset).

- [ ] **Step 11: Verify `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test`** runs the 9 integration tests against real Chrome — all 9 pass.

- [ ] **Step 12: Commit** — `feat(integration): capability tests for all 9 browser-driving packages (P9T7)`

---

### Task 8: CI hardening — integration job, SHA-pin, changeset-status guard

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `scripts/pin-actions.md`

Three CI improvements in one task because they all touch `ci.yml`:

1. **Integration job** (new) — runs `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` after the unit + build matrix. Uses `actions/cache` for the Chrome download.
2. **SHA-pin actions** — replace `@v4` floats on `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `actions/cache`, `actions/upload-artifact`, `actions/download-artifact` with the immutable commit SHA + version comment. Document the pin/unpin workflow in `scripts/pin-actions.md`.
3. **Changeset-status guard** — add a step `pnpm changeset status --since=origin/main` in the unit job. Fails when a non-doc PR is missing a changeset.

- [ ] **Step 1: Read current `.github/workflows/ci.yml`** to internalize the existing structure.

- [ ] **Step 2: Create `scripts/pin-actions.md`** — the human-runnable checklist for SHA-pinning. Document the recommended tool (`pinact`) and the recovery procedure (`git revert <pin-commit>` if a pinned SHA turns out to be revoked).

- [ ] **Step 3: Add the changeset-status guard step** to the existing unit/lint/test/build job — runs after `pnpm install`, before `pnpm test`. The guard exits non-zero if the PR's commits lack a changeset.

- [ ] **Step 4: Add the integration job** — `needs: [build]`, runs `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test`, uses `actions/cache` keyed on the Chrome build version from `chrome-setup`.

- [ ] **Step 5: Apply SHA-pins** to all action `uses:` lines. The implementer runs `pinact run .github/workflows/ci.yml` (if `pinact` is available) or hand-pins from the GitHub UI by looking up the SHA for each `@v4` tag.

- [ ] **Step 6: Verify locally** — there's no good way to dry-run a GitHub workflow locally; the implementer commits and observes the PR's CI run, iterating if pins fail. The plan flags this as the one task whose verification happens AFTER PR push.

- [ ] **Step 7: Commit** — `ci: add integration job, SHA-pin actions, add changeset-status guard (P9T8)`

---

### Task 9: Consumer documentation — `@types/node` + npm org checklist

**Files:**
- Modify: `packages/{chrome-setup,logger,config,launcher,navigation,downloads,session}/README.md` (the ones whose `.d.ts` reference Node types) — add a "Requirements" note.
- Create: `docs/npm-publish-checklist.md`

- [ ] **Step 1: Identify packages** whose emitted `.d.ts` reference Node-specific types. Run:

```bash
for pkg in packages/*/dist/index.d.ts; do
  grep -l -E "from ['\"]node:|@types/node|EventEmitter|Buffer|process\." "$pkg" 2>/dev/null
done
```

Expected hits: `chrome-setup` (uses `@puppeteer/browsers` which references Node), `logger` (EventEmitter), `config` (process.env), `launcher` (process), `navigation` (uses retry which uses AbortSignal), `downloads` (`node:fs/promises`), `session` (none directly — verify), maybe `network` (none).

- [ ] **Step 2: For each identified package**, add a "Requirements" section to its `README.md`:

```markdown
## Requirements

This package's emitted TypeScript definitions reference Node's built-in
types (`Buffer`, `EventEmitter`, `node:fs`, etc.). Your consumer project
must have `@types/node` installed as a devDependency:

```bash
npm install --save-dev @types/node
# or: pnpm add -D @types/node
```

(npm 10+ may auto-install via peer-warnings, but explicitly is safer.)
```

- [ ] **Step 3: Create `docs/npm-publish-checklist.md`** — the BEFORE-FIRST-PUBLISH human checklist:

```markdown
# npm Publish Checklist (pre-Plan 09 release.yml first run)

## Done once, BEFORE the first `release.yml` execution

- [ ] `@technical-1` npm scope exists. If not: `npm org create technical-1` (your account becomes owner).
- [ ] `NPM_TOKEN` GitHub Secret is set with `automation` token + publish access to `@technical-1`.
- [ ] Confirm `package.json` `publishConfig.access` is `"public"` on every package (already true from scaffold).
- [ ] First-publish dry-run: `pnpm changeset version` to preview version bumps, inspect the `*/CHANGELOG.md` diff, then `pnpm changeset version --reset` to undo.
- [ ] Dry-run `pnpm pack` in 2-3 representative packages (`core`, `launcher`, `captcha`) and inspect the tarball contents — confirm `dist/` is present, no test files, no source maps to disallow if you so choose.

## On every release (automatic via `release.yml`)

- [ ] `release.yml` opens a Version PR.
- [ ] Reviewer inspects the diff: version bumps, changelogs.
- [ ] Merge the Version PR → triggers `pnpm publish` for each changed package.
- [ ] `release.yml` creates GitHub Releases tagged per package.

## Recovery

- npm publish is irreversible for 72h, but you can `npm deprecate @technical-1/<pkg>@<v>` immediately.
- If `release.yml` fails mid-publish, some packages may have shipped: inspect `npm view @technical-1/<pkg> versions` to see what landed; ship a patch for whatever broke.
```

- [ ] **Step 4: Verify the additions** — `pnpm turbo run lint build` still green; READMEs render correctly (no broken markdown).

- [ ] **Step 5: Commit** — `docs: @types/node consumer note + npm publish checklist (P9T9)`

---

### Task 10: `release.yml` — Changesets publish pipeline

**Files:**
- Create: `.github/workflows/release.yml`

The standard Changesets pipeline: on push to `main`, the action opens a "Version PR" containing the changeset version bumps. When that PR merges, it runs `pnpm publish` for each changed package.

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: release
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write
  id-token: write  # for npm provenance

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        # SHA-pinned: actions/checkout@v4.2.2
        uses: actions/checkout@<SHA-FROM-P9T8>
        with:
          fetch-depth: 0

      - name: Setup pnpm
        # SHA-pinned: pnpm/action-setup@v4.0.0
        uses: pnpm/action-setup@<SHA-FROM-P9T8>

      - name: Setup Node
        # SHA-pinned: actions/setup-node@v4.0.4
        uses: actions/setup-node@<SHA-FROM-P9T8>
        with:
          node-version: '22'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build (gating)
        run: pnpm turbo run build

      - name: Create Release Pull Request or Publish
        id: changesets
        # SHA-pinned: changesets/action@v1.4.10
        uses: changesets/action@<SHA-FROM-P9T8>
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
          commit: "chore: release packages"
          title: "Release"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
```

(SHAs for each action will be filled by `pinact` or hand-resolved per P9T8.)

- [ ] **Step 2: Document the workflow** in `docs/npm-publish-checklist.md` with a "How release.yml works" subsection.

- [ ] **Step 3: Verify YAML syntax** — `pnpx js-yaml .github/workflows/release.yml` (or just visual inspection) — must parse.

- [ ] **Step 4: Commit** — `ci: release.yml Changesets publish pipeline (P9T10)`

---

### Task 11: Dry-run verification

- [ ] **Step 1: Run `pnpm changeset status`** — must list the 8 changesets currently pending (initial-core, utility-tier, browser-foundation, navigation-data, anti-detection, state-traffic, output-tier, captcha). Each correctly bumps its target package(s) minor.

- [ ] **Step 2: Run `pnpm changeset version`** — generates the version bumps and updates `CHANGELOG.md` per package. INSPECT the diff: every package goes from `0.0.0` → `0.1.0` (first minor), each `CHANGELOG.md` has a clean entry.

- [ ] **Step 3: Stash the changeset-version output** without committing — `git stash`. (We do NOT commit this; the live `release.yml` will own the version bump.)

- [ ] **Step 4: Run `pnpm pack` on 3 representative packages** and inspect the tarballs:

```bash
cd packages/core && pnpm pack && tar tf @technical-1-core-*.tgz | head -30
cd packages/launcher && pnpm pack && tar tf @technical-1-launcher-*.tgz | head -30
cd packages/captcha && pnpm pack && tar tf @technical-1-captcha-*.tgz | head -30
```

Verify each tarball contains:
- `package/package.json`
- `package/README.md`
- `package/dist/index.{js,cjs,d.ts,d.cts}`
- No `src/`, no `node_modules/`, no `.test.ts`.

Clean up the `.tgz` files: `find packages/ -name '*.tgz' -delete`.

- [ ] **Step 5: Restore the stash** — `git stash pop` and discard the version-bump changes (they belong to `release.yml`, not this PR): `git checkout -- packages/*/package.json packages/*/CHANGELOG.md`. Verify `git status` is clean.

- [ ] **Step 6: Document the dry-run results** in `docs/npm-publish-checklist.md` under a "Last dry-run" section: monorepo state, package count, tarball sizes.

- [ ] **Step 7: Commit** — `docs: Plan 09 dry-run results (P9T11)`

---

### Task 12: Final changeset + monorepo CI gate

**Files:**
- Create: `.changeset/release-prep.md`

- [ ] **Step 1: Create `.changeset/release-prep.md`** — empty changeset (no version bumps; this is a meta-changeset documenting the publish-prep work):

```markdown
---
---

(Plan 09 — publish-prep, no version bumps.)

This branch ships the release infrastructure for the @technical-1 suite:
- Per-package examples under `examples/`.
- Integration tier under `tests/integration/`, gated by `PPTR_IT=1`.
- `.github/workflows/release.yml` Changesets publish pipeline.
- tsup sourcemap dedup, SHA-pinned actions, `workspace:^` internal-dep range, changeset-status CI guard, `@types/node` consumer note.

The first `release.yml` run after this branch merges will bump all 19
published packages 0.0.0 → 0.1.0 and ship to npm.
```

- [ ] **Step 2: Whole-monorepo CI gate**

```bash
pnpm turbo run lint test build --output-logs=errors-only
```

Expected: 60+ successful tasks (19 published packages × 3 + examples typecheck/lint + integration unit-tier server test/lint/typecheck = at least 63 task entries). 0 failures.

Test count: still 173 from the published packages, plus 3 from `tests/integration/src/server.test.ts` + 3 from `scripts/dedup-sourcemap.test.js` = **179 monorepo total**.

- [ ] **Step 3: Final invariant sweep**
  - `grep -ri autom8ops .` (exclude node_modules, .git) → 0 hits (or only the plan-doc grep instructions, which are self-referential and intentional).
  - `git log feat/09-examples-integration-release --not main --format='%an <%ae>' | sort -u` → only `Jacob Kanfer <kanfer@users.noreply.github.com>`.
  - `pnpm changeset status` → lists 9 changesets (the 8 from earlier plans + `release-prep`).

- [ ] **Step 4: Commit** — `chore: changeset for the examples + integration + release-prep tier (P9T12)`

---

## Self-review checklist

- [ ] All 12 tasks have passing tests / typechecks / lint
- [ ] `pnpm turbo run lint test build` exits 0
- [ ] `pnpm changeset status` lists 9 changesets (8 from prior plans + `release-prep`)
- [ ] `pnpm pack` on 3 sampled packages produces clean tarballs (no src/, no tests)
- [ ] `grep -ri autom8ops .` (excluding node_modules, .git) returns only self-referential plan-doc grep instructions
- [ ] Single-author check: `git log feat/09-... --not main --format='%an <%ae>' | sort -u` shows only `Jacob Kanfer <kanfer@users.noreply.github.com>`
- [ ] Every `packages/*/dist/index.{js,cjs}` has exactly ONE `sourceMappingURL` line (P9T2 verification)
- [ ] All workspace-internal deps use `workspace:^` (P9T1 verification)
- [ ] `.github/workflows/ci.yml` actions are SHA-pinned (P9T8)
- [ ] `.github/workflows/release.yml` actions are SHA-pinned (P9T10)
- [ ] `docs/npm-publish-checklist.md` documents the human checklist
- [ ] Default `pnpm test` does NOT run real Chrome (integration tier skips when `PPTR_IT` is unset)
- [ ] `PPTR_IT=1 pnpm --filter @technical-1/integration-tests test` runs the 9 capability integration tests against real Chrome (manual verification by human; CI runs this in the integration job)
- [ ] No new published packages introduced — Plan 09 is publish-prep only

---

## After Plan 09 merges to main

1. **Set up npm credentials** per `docs/npm-publish-checklist.md`:
   - Confirm `@technical-1` npm scope.
   - Add `NPM_TOKEN` GitHub Secret.
2. **Watch `release.yml` open the Version PR** — inspect the diff (every package 0.0.0 → 0.1.0, changelogs populated).
3. **Merge the Version PR** — `release.yml` runs `pnpm publish` for each package; npm packages appear under `https://npmjs.com/package/@technical-1/<name>`.
4. **Plan 10** (pre-1.0 surface review) addresses the deferred 1.0-blocking surface decisions.
5. **Plans 11-12** ship the Puppeteer-Template repo's `electron-gui-app` and `cli-app` templates consuming the now-published packages.
