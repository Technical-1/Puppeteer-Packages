import { PptrKitError } from "@technical-1/core";

export interface ConfigField<V> {
  /** Environment variable name to read. */
  env: string;
  /** Value used when the env var is absent OR set to an empty string. */
  default?: V;
  /** Convert the raw string to V. Omit to keep the raw string. */
  parse?: (raw: string) => V;
  /**
   * When true, a missing env var with no `default` throws a core
   * `PptrKitError`. "Missing" means unset OR an empty string — a blank
   * value does NOT satisfy a required field. If a `default` is also
   * provided, the default is used and nothing is thrown (the default
   * satisfies the requirement).
   */
  required?: boolean;
}

export type ConfigSchema<T> = { [K in keyof T]: ConfigField<T[K]> };

/**
 * Resolve a typed config object from a schema. Reads `env` (defaults to
 * `process.env`). An env var that is unset OR an empty string is treated as
 * absent. A missing required field with no `default` throws a core
 * `PptrKitError` whose `context` carries the offending env var NAME (never
 * its value — no secret leakage).
 */
export function loadConfig<T>(
  schema: ConfigSchema<T>,
  env: Record<string, string | undefined> = process.env,
): T {
  const out: Partial<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = schema[key];
    const raw = env[field.env];
    const missing = raw === undefined || raw === "";
    if (missing) {
      if (field.required && field.default === undefined) {
        throw new PptrKitError(`Missing required config: ${field.env}`, {
          context: { env: field.env },
        });
      }
      out[key] = field.default as T[keyof T];
    } else {
      out[key] = (field.parse ? field.parse(raw) : raw) as T[keyof T];
    }
  }
  // Single assertion: the loader trusts the caller's schema to cover every
  // non-optional key of T (via a default or a present/required env var).
  // Localizing the cast here keeps the type-contract boundary in one place.
  return out as T;
}
