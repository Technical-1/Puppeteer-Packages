---
"@technical-1/emulation": patch
---

Export the media-emulation union types (`ColorGamut`, `ColorScheme`, `ForcedColors`, `MediaType`, `ReducedMotion`) from the package entry point, and throw a typed `ConfigError` (instead of a bare error) when `emulateDevice` is given an unknown device preset.
