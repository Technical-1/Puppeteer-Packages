# npm Publish Checklist

## Done once, BEFORE the first `release.yml` execution

- [ ] `@technical-1` npm scope exists. If not: `npm org create technical-1` (your account becomes owner).
- [ ] `NPM_TOKEN` GitHub Secret is set with an `automation` token that has publish access to `@technical-1`.
- [ ] Confirm `publishConfig.access` is `"public"` (or `.changeset/config.json` `access: "public"`) so scoped packages publish publicly.
- [ ] First-publish dry-run: `pnpm changeset version` to preview version bumps, inspect the `*/CHANGELOG.md` diffs, then discard (do NOT commit) before the real release runs.
- [ ] Dry-run `pnpm pack` in 2-3 representative packages (`core`, `launcher`, `captcha`) and inspect the tarball contents — confirm `dist/` is present, no `src/`, no test files.

## On every release (automatic via `release.yml`)

- [ ] `release.yml` opens a Version PR.
- [ ] Reviewer inspects the diff: version bumps, changelogs.
- [ ] Merge the Version PR → triggers `pnpm changeset publish` for each changed package.
- [ ] `release.yml` creates GitHub Releases tagged per package.

## Recovery

- npm publish is irreversible for 72h, but you can `npm deprecate @technical-1/<pkg>@<v>` immediately.
- If `release.yml` fails mid-publish, some packages may have shipped: inspect `npm view @technical-1/<pkg> versions` to see what landed; ship a patch for whatever broke.

## How release.yml works

`release.yml` implements the standard two-phase Changesets flow:

### Phase 1 — Version PR accumulation

Every push to `main` runs the `changesets/action`. As long as unconsumed
`.changeset/*.md` files exist in the repo, the action opens (or force-updates)
a **Version PR** titled "Release". That PR's diff contains:

- Bumped `version` fields in each affected `package.json`
- Generated / appended `CHANGELOG.md` entries
- Deletion of the consumed `.changeset/*.md` stubs

The PR accumulates further changesets from subsequent merges — it is
continuously rebased by the action until you merge it.

### Phase 2 — Publish on Version PR merge

Merging the Version PR causes `main` to have no remaining changeset stubs.
The action detects this and instead of opening a PR it runs:

```
pnpm changeset publish
```

This publishes every package whose `version` in `package.json` is not yet
on the npm registry. After publishing it pushes git tags of the form
`@technical-1/<pkg>@<version>` and creates GitHub Releases for each.

### workspace:^ rewrite

All packages in this monorepo declare cross-package deps as `workspace:^`.
At publish time, pnpm rewrites each `workspace:^` specifier to the concrete
`^<resolved-version>` before packing the tarball. npm consumers therefore
receive a normal semver range and automatically satisfy a newer compatible
internal dep without any manual pin updates.

### Provenance

The workflow sets `permissions: id-token: write` and passes
`NPM_CONFIG_PROVENANCE: "true"` to the changesets action environment. This
causes npm to attach a signed SLSA provenance attestation to each published
package, linking it to the specific GitHub Actions run that produced it.
Consumers can verify: `npm audit signatures @technical-1/<pkg>`.

### npm auth wiring

`actions/setup-node` with `registry-url: https://registry.npmjs.org` writes
`~/.npmrc` containing `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`.
The changesets action's publish invocation also reads `NPM_TOKEN` from env.
Both env vars are set to `${{ secrets.NPM_TOKEN }}` in the step so either
code path authenticates correctly.

## Last dry-run

Dry-run performed on the P9T11 branch.

### Monorepo state

- **19 published packages**, all at `0.0.0` — would all bump to `0.1.0` (minor) on first release.
- **8 pending changesets** (`.changeset/anti-detection.md`, `browser-foundation.md`, `captcha.md`, `initial-core.md`, `navigation-data.md`, `output-tier.md`, `state-traffic.md`, `utility-tier.md`).

### `pnpm changeset version` preview

`changeset version` ran cleanly:

- All 19 package.json files bumped from `0.0.0` → `0.1.0`.
- All 19 `CHANGELOG.md` files were generated with clean `## 0.1.0` sections sourced from the changeset descriptions.
- `workspace:^` internal-dependency specifiers were **not rewritten** at `version` time — they remain `"workspace:^"` in package.json. Rewrite to concrete `^0.1.0` happens only at `pnpm changeset publish` time (pnpm rewrites specifiers when packing the tarball).
- JSON formatting in package.json files was prettified (object literals expanded) but no semantic fields changed beyond the version bump.

Full revert was performed immediately after inspection (`git checkout -- .changeset packages` + removal of untracked CHANGELOG.md files). `git status --porcelain` returned empty; all 8 changeset stubs confirmed restored.

### `pnpm pack` tarball inspection (representative packages)

All three packages were built via `pnpm turbo run build` (cached hit — 38ms) before packing.

| Package | Tarball | Size |
|---|---|---|
| `@technical-1/core` | `technical-1-core-0.0.0.tgz` | 3 343 bytes |
| `@technical-1/launcher` | `technical-1-launcher-0.0.0.tgz` | 6 104 bytes |
| `@technical-1/captcha` | `technical-1-captcha-0.0.0.tgz` | 5 520 bytes |

Each tarball contained exactly:

```
package/README.md
package/package.json
package/dist/index.cjs
package/dist/index.cjs.map
package/dist/index.d.cts
package/dist/index.d.ts
package/dist/index.js
package/dist/index.js.map
```

**Present:** `dist/` with all 4 output files (ESM + CJS + dual `.d.ts`) plus sourcemaps, `package.json`, `README.md`.

**Absent:** `src/`, `*.test.ts`, `tsconfig*.json`, `vitest.config*`, `node_modules/`.

All `.tgz` files were deleted after inspection. `git status --porcelain` confirmed empty.
