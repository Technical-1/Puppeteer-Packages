import { PptrKitError } from "@technical-1/core";

export interface ConfigField<V = string> {
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

/**
 * Back-compat alias. `loadConfig` now infers the schema literal directly, but
 * this type is still re-exported for callers that name their schema shape.
 */
export type ConfigSchema<T> = { [K in keyof T]: ConfigField<T[K]> };

/** The value type a single field resolves to. */
type FieldValue<F> = F extends ConfigField<infer V> ? V : never;

/**
 * The object `loadConfig` returns for a given schema literal `S`. A field that
 * is `required:true` or carries a `default` is guaranteed present; a field with
 * neither surfaces as `V | undefined`, because at runtime it resolves to the
 * (absent) default.
 */
export type ResolvedConfig<S extends Record<string, ConfigField<unknown>>> = {
  [K in keyof S]: S[K] extends { required: true }
    ? FieldValue<S[K]>
    : S[K] extends { default: unknown }
      ? FieldValue<S[K]>
      : FieldValue<S[K]> | undefined;
};

/**
 * Resolve a typed config object from a schema. Reads `env` (defaults to
 * `process.env`). An env var that is unset OR an empty string is treated as
 * absent. A missing required field with no `default` throws a core
 * `PptrKitError` whose `context` carries the offending env var NAME (never
 * its value — no secret leakage). Optional fields with no default surface as
 * `V | undefined` in the return type.
 */
export function loadConfig<S extends Record<string, ConfigField<unknown>>>(
  schema: S,
  env: Record<string, string | undefined> = process.env,
): ResolvedConfig<S> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(schema)) {
    const field = schema[key] as ConfigField<unknown>;
    const raw = env[field.env];
    const missing = raw === undefined || raw === "";
    if (missing) {
      if (field.required && field.default === undefined) {
        throw new PptrKitError(`Missing required config: ${field.env}`, {
          context: { env: field.env },
        });
      }
      out[key] = field.default;
    } else {
      out[key] = field.parse ? field.parse(raw) : raw;
    }
  }
  return out as ResolvedConfig<S>;
}
