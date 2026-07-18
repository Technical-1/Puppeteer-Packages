---
"@technical-1/interaction-helpers": minor
---

Expand interaction-helpers with iframe-aware interaction, file upload, infinite scroll, and keyboard shortcuts.

- `safeClick`/`safeType`/`waitAndGet`/`scroll` now accept a `Page` or a `Frame`.
- `resolveFrame(page, { name | url | selector })` locates a `Frame` (by name, url substring/RegExp, or `<iframe>` selector) for frame-scoped interaction.
- `uploadFile` sets files on a plain `<input type=file>`; `uploadViaFileChooser` drives a styled button through the native file chooser. Both surface `SelectorNotFoundError`/`TimeoutError`.
- `autoScroll` scrolls until lazy-loaded content stops growing (poll-until-stable with a settle wait and a `maxScrolls` cap).
- `pressKey`/`pressShortcut` press Enter/Escape/Tab or Ctrl/Cmd/Shift/Alt + key combinations.
- `ScrollOptions` now extends `LoggerOption` and `scroll` emits a `"step"` log line, matching the other helpers.
