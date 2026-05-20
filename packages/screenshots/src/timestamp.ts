import { join } from "node:path";

/** Injectable clock — override in tests. */
export type Clock = () => Date;

/**
 * Build a filesystem-safe path like `<dir>/<base>-YYYY-MM-DDTHH-MM-SS-mmmZ.<ext>`.
 *
 * Colons in the standard ISO-8601 string are replaced with dashes (`:` is
 * illegal in Windows filenames; the dash form is portable across all OSes).
 */
export function timestampedPath(
  dir: string,
  base: string,
  ext: string = "png",
  now: Clock = () => new Date(),
): string {
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  return join(dir, `${base}-${stamp}.${ext}`);
}
