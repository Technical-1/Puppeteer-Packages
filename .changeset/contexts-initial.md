---
"@technical-1/contexts": minor
---

New package: isolated BrowserContext lifecycle. `createIsolatedContext` and
`withContext` (guaranteed finally-cleanup) create incognito-style contexts with
optional per-context proxy and permission overrides; `listContextTargets`,
`overridePermissions`, and `clearContextPermissions` round out the surface. Fixes
the multi-account cross-storage-bleed risk in `@technical-1/session` by giving
each account its own isolated context. Errors are the new `ContextError`.
