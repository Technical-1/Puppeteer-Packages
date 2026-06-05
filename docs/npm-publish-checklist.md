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
