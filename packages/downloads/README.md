# @technical-1/downloads

Await file downloads to a target directory via CDP `Browser.setDownloadBehavior`
+ filesystem polling.

```ts
import { enableDownloads, awaitDownload } from "@technical-1/downloads";

await enableDownloads(browser, "./downloads");

const file = await awaitDownload("./downloads", async () => {
  await page.click("#download-button");
});

console.log(file.path, file.size);
```

## How it works

`enableDownloads` sends CDP `Browser.setDownloadBehavior` with policy
`"allow"` and `downloadPath: dir`. `awaitDownload` snapshots the directory
before invoking `triggerFn`, then polls every 100ms for new files,
ignoring `.crdownload` until they rename. Returns when a new completed
file appears, or rejects with `PptrKitError(retryable:true)` on timeout.

## v1 limitations

- Filesystem polling (100ms tick) — robust but adds at most ~100ms of
  observation latency. CDP `Browser.downloadProgress` event is the v2 path.
- Single-download awaits — concurrent downloads to the same directory need
  caller-side coordination in v1.

## Peer

Requires `puppeteer-core` `>=22 <25`.
