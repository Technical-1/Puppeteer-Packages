import type { CoverageEntry } from "puppeteer-core";

/** A half-open covered/uncovered byte range `[start, end)` within a file's text. */
export interface CoverageRange {
  start: number;
  end: number;
}

/** Which coverage domain a file's data came from. */
export type CoverageType = "js" | "css";

/** Per-file coverage: total vs used bytes, with the used and unused ranges. */
export interface FileCoverage {
  url: string;
  type: CoverageType;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  usedRanges: CoverageRange[];
  unusedRanges: CoverageRange[];
}

/** A rolled-up total across some set of files. */
export interface CoverageSummary {
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  /** usedBytes / totalBytes, in `[0, 1]`; `0` when there are no bytes. */
  usedRatio: number;
}

/** Sum of `(end - start)` over ranges (assumes non-overlapping, as V8/CDP emits). */
export function usedBytesOf(ranges: readonly CoverageRange[]): number {
  let used = 0;
  for (const r of ranges) used += r.end - r.start;
  return used;
}

/** Sort, clamp to `[0, length]`, and merge ranges into a normalized non-overlapping set. */
function normalize(ranges: readonly CoverageRange[], length: number): CoverageRange[] {
  const clamped = ranges
    .map((r) => ({ start: Math.max(0, Math.min(r.start, length)), end: Math.max(0, Math.min(r.end, length)) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: CoverageRange[] = [];
  for (const r of clamped) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** The gaps in `[0, length)` not covered by `ranges` (sorted, clamped, overlap-safe). */
export function complementRanges(
  ranges: readonly CoverageRange[],
  length: number,
): CoverageRange[] {
  const used = normalize(ranges, length);
  const gaps: CoverageRange[] = [];
  let cursor = 0;
  for (const r of used) {
    if (r.start > cursor) gaps.push({ start: cursor, end: r.start });
    cursor = r.end;
  }
  if (cursor < length) gaps.push({ start: cursor, end: length });
  return gaps;
}

/** Reduce one raw `CoverageEntry` into a `FileCoverage`. */
export function fileCoverageOf(entry: CoverageEntry, type: CoverageType): FileCoverage {
  const totalBytes = entry.text.length;
  const usedRanges = entry.ranges.map((r) => ({ start: r.start, end: r.end }));
  const usedBytes = usedBytesOf(usedRanges);
  return {
    url: entry.url,
    type,
    totalBytes,
    usedBytes,
    unusedBytes: totalBytes - usedBytes,
    usedRanges,
    unusedRanges: complementRanges(usedRanges, totalBytes),
  };
}

/** Roll up files into a summary; pass a `type` to include only that domain. */
export function summarize(
  files: readonly FileCoverage[],
  type?: CoverageType,
): CoverageSummary {
  let totalBytes = 0;
  let usedBytes = 0;
  for (const f of files) {
    if (type !== undefined && f.type !== type) continue;
    totalBytes += f.totalBytes;
    usedBytes += f.usedBytes;
  }
  return {
    totalBytes,
    usedBytes,
    unusedBytes: totalBytes - usedBytes,
    usedRatio: totalBytes === 0 ? 0 : usedBytes / totalBytes,
  };
}
