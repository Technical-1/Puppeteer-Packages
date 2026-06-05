import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Collapse runs of identical `//# sourceMappingURL=...` lines to a single
 * occurrence. tsup 8.5.x emits the directive twice; this normalizes the
 * output for `npm pack`. Idempotent. Handles N>=2 consecutive identical lines
 * by looping until stable (only collapses adjacent-identical lines; differing
 * URLs on separate entry-points are left untouched).
 */
export function dedupSourcemapComment(text) {
  let prev;
  do {
    prev = text;
    text = text.replace(
      /^(\/\/# sourceMappingURL=.+)\r?\n\1(\r?\n|$)/gm,
      "$1$2",
    );
  } while (text !== prev);
  return text;
}

/**
 * Apply the dedup to every `.js` and `.cjs` file in the dist directory
 * (intentionally includes chunk files, not just entry points). A missing dist
 * directory is treated as a clean no-op; any other error is rethrown.
 */
export async function dedupInDist(distDir) {
  let entries;
  try {
    entries = await readdir(distDir);
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const name of entries) {
    if (!name.endsWith(".js") && !name.endsWith(".cjs")) continue;
    const path = join(distDir, name);
    const s = await stat(path);
    if (!s.isFile()) continue;
    const text = await readFile(path, "utf8");
    const out = dedupSourcemapComment(text);
    if (out !== text) await writeFile(path, out, "utf8");
  }
}

// CLI entry — called from tsup's onSuccess hook with the package's dist dir.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (typeof dir !== "string") {
    console.error("usage: dedup-sourcemap.js <distDir>");
    process.exit(2);
  }
  dedupInDist(dir).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
