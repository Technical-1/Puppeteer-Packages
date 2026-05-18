# @technical-1/config

A tiny typed loader: declare a schema mapping config keys to env var names,
defaults, and parsers; `loadConfig` returns a fully-typed object. Missing
required keys throw a `@technical-1/core` `PptrKitError` carrying the offending
env var in `context`. An env var that is unset or an empty string is treated as missing.

```ts
import { loadConfig } from "@technical-1/config";

const cfg = loadConfig({
  headless: { env: "PPTR_HEADLESS", default: true, parse: (v) => v !== "false" },
  captchaKey: { env: "CAPTCHA_API_KEY", required: true },
});
```

No bundled credentials or secrets — values come only from the supplied env.
