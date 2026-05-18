import { PptrKitError } from "@technical-1/core";

export interface ConfigField<V> {
  /** Environment variable name to read. */
  env: string;
  /** Value used when the env var is absent. */
  default?: V;
  /** Convert the raw string to V. Omit to keep the raw string. */
  parse?: (raw: string) => V;
  /** When true, a missing env var (and no default) throws. */
  required?: boolean;
}

export type ConfigSchema<T> = { [K in keyof T]: ConfigField<T[K]> };

/**
 * Resolve a typed config object from a schema. Reads `env` (defaults to
 * `process.env`). Throws a core `PptrKitError` for a missing required field.
 */
export function loadConfig<T>(
  schema: ConfigSchema<T>,
  env: Record<string, string | undefined> = process.env,
): T {
  const out = {} as T;
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const field = schema[key];
    const raw = env[field.env];
    if (raw === undefined) {
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
  return out;
}
