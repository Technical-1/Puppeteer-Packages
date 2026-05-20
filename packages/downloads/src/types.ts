/** Result of a completed download. */
export interface DownloadResult {
  /** Absolute path to the downloaded file. */
  path: string;
  /** Filename as it appeared in the target directory. */
  filename: string;
  /** Bytes on disk at the moment polling detected completion. */
  size: number;
}

/** Options for `awaitDownload`. */
export interface AwaitDownloadOptions {
  /** Milliseconds before rejecting with a PptrKitError. Default 30_000. */
  timeoutMs?: number;
  /** Polling interval in ms. Default 100. */
  pollMs?: number;
}
