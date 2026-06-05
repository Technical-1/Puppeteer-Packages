/**
 * @technical-1/config — loadConfig demo
 *
 * Demonstrates schema definition, env injection, parse callbacks, defaults,
 * and the required-field error path.
 *
 * Run: pnpm tsx examples/src/config.example.ts
 */

import { loadConfig } from "@technical-1/config";
import type { ConfigSchema } from "@technical-1/config";
import { PptrKitError } from "@technical-1/core";

// ── Schema definition ────────────────────────────────────────────────────────
interface ScraperConfig {
  baseUrl: string;
  timeout: number;
  headless: boolean;
  apiKey: string | undefined;
}

const schema: ConfigSchema<ScraperConfig> = {
  baseUrl: {
    env: "SCRAPER_BASE_URL",
    default: "https://example.com",
  },
  timeout: {
    env: "SCRAPER_TIMEOUT_MS",
    default: 30_000,
    parse: (raw) => parseInt(raw, 10),
  },
  headless: {
    env: "SCRAPER_HEADLESS",
    default: true,
    parse: (raw) => raw !== "false",
  },
  apiKey: {
    env: "SCRAPER_API_KEY",
    // no default, not required → resolves to undefined when absent
  },
};

// ── Happy path: all defaults ─────────────────────────────────────────────────
const cfg1 = loadConfig(schema, {});
console.log(cfg1.baseUrl);  // => https://example.com
console.log(cfg1.timeout);  // => 30000
console.log(cfg1.headless); // => true
console.log(cfg1.apiKey);   // => undefined

// ── Overrides via injected env ───────────────────────────────────────────────
const cfg2 = loadConfig(schema, {
  SCRAPER_BASE_URL: "https://staging.example.com",
  SCRAPER_TIMEOUT_MS: "10000",
  SCRAPER_HEADLESS: "false",
  SCRAPER_API_KEY: "sk-test-abc",
});
console.log(cfg2.baseUrl);   // => https://staging.example.com
console.log(cfg2.timeout);   // => 10000
console.log(cfg2.headless);  // => false
console.log(cfg2.apiKey);    // => sk-test-abc

// ── Required field missing → PptrKitError ───────────────────────────────────
interface SecretConfig {
  token: string;
}
const secretSchema: ConfigSchema<SecretConfig> = {
  token: { env: "SECRET_TOKEN", required: true },
};

try {
  loadConfig(secretSchema, {});
} catch (err) {
  if (err instanceof PptrKitError) {
    console.log("missing required config caught:", err.message);
    // => missing required config caught: Missing required config: SECRET_TOKEN
    console.log("context (no secret leakage):", err.context);
    // => context (no secret leakage): { env: 'SECRET_TOKEN' }
  }
}
