# @technical-1/contexts

## 1.1.0

### Minor Changes

- 809f77e: New package: isolated BrowserContext lifecycle. `createIsolatedContext` and
  `withContext` (guaranteed finally-cleanup) create incognito-style contexts with
  optional per-context proxy and permission overrides; `listContextTargets`,
  `overridePermissions`, and `clearContextPermissions` round out the surface. Fixes
  the multi-account cross-storage-bleed risk in `@technical-1/session` by giving
  each account its own isolated context. Errors are the new `ContextError`.

### Patch Changes

- Updated dependencies [c1b1c0c]
- Updated dependencies [122c871]
- Updated dependencies [34f2973]
  - @technical-1/core@1.1.0
