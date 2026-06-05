# SHA-pinning GitHub Actions

## Recommended tool: pinact

[pinact](https://github.com/suzuki-shunsuke/pinact) resolves and updates every
`uses:` line in a workflow file to a commit SHA in one command:

```bash
# Install (once)
go install github.com/suzuki-shunsuke/pinact/cmd/pinact@latest

# Pin / re-pin all workflows
pinact run .github/workflows/*.yml
```

pinact writes `owner/repo@<sha> # vX.Y.Z` comments automatically and handles
annotated-tag dereferencing.

---

## Manual gh-CLI fallback (used when pinact is unavailable)

`gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` always resolves to the
**commit** SHA pointed to by a tag (GitHub dereferences annotated tags for
you on the `/commits/<ref>` endpoint). This is the SHA GitHub Actions uses.

```bash
# Pattern (replace owner/repo and tag):
gh api repos/actions/checkout/commits/v6.0.3 --jq .sha

# Verify the result is 40 hex chars:
gh api repos/actions/checkout/commits/v6.0.3 --jq '.sha | length'
# → 40
```

---

## Pinned SHA table

| Action | Version pinned | Commit SHA |
|--------|---------------|------------|
| `actions/checkout` | v6.0.3 | `df4cb1c069e1874edd31b4311f1884172cec0e10` |
| `pnpm/action-setup` | v6.0.8 | `0e279bb959325dab635dd2c09392533439d90093` |
| `actions/setup-node` | v6.4.0 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| `actions/cache` | v5.0.5 | `27d5ce7f107fe9357f9df03efb73ab90386fccae` |
| `actions/upload-artifact` | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/download-artifact` | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` |
| `changesets/action` | v1.9.0 | `a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d` |

`changesets/action` is pinned here for reference — it is used in
`.github/workflows/release.yml` (added in Plan 10 / Task T10).

---

## Recovery procedure

If a pinned SHA turns out to be bad or is revoked (rare but possible):

```bash
# 1. Identify the bad commit
git log --oneline --all | grep "SHA-pin"

# 2. Revert it
git revert <commit-sha>

# 3. Re-resolve the correct SHA for the affected action
gh api repos/<owner>/<repo>/commits/<good-tag> --jq .sha

# 4. Edit the workflow file and recommit
```

Do NOT use `git reset --hard` — that rewrites history and causes problems for
collaborators and protected branches.

---

## Updating pins

When an action releases a new version you want to adopt:

1. Find the new tag: `gh api repos/<owner>/<repo>/git/refs/tags --jq '.[].ref' | sort -V | tail -5`
2. Resolve its commit SHA: `gh api repos/<owner>/<repo>/commits/<new-tag> --jq .sha`
3. Update the `uses:` line in the workflow: `owner/repo@<new-sha> # vX.Y.Z`
4. Update the table above.
5. Commit: `ci: bump <action> to <new-version> (SHA-pin update)`

Or re-run `pinact run .github/workflows/*.yml` which handles steps 1–4
automatically for all actions at once.

---

## Security note

SHA-pinning prevents supply-chain attacks where a mutable tag (e.g., `v4`) is
force-pushed to a malicious commit. Always pin to a commit SHA, never to a
moving tag. The `# vX.Y.Z` comment is purely for human readability and has no
effect on execution.
