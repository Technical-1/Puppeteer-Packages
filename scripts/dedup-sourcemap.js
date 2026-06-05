import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Collapse runs of identical `//# sourceMappingURL=...` lines to a single
 * occurrence. tsup 8.5.x emits the directive twice; this normalizes the
 * output for `npm pack`. Idempotent.
 */
export function dedupSourcemapComment(text) {
  return text.replace(
    /^(\/\/# sourceMappingURL=.+)\r?\n\1(\r?\n|$)/gm,
    "$1$2",
  );
}

/** Apply the dedup to every `index.{js,cjs}` under the given dist directory. */
export async function dedupInDist(distDir) {
  const entries = await readdir(distDir);
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
