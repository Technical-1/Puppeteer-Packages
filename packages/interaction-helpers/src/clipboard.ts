import type { Page, Permission } from "puppeteer-core";
import { ConfigError, PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

// In-page global (runs inside Chromium, not Node). Declare only what we use.
declare var navigator: {
  clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
};

export interface ClipboardOptions extends LoggerOption {}

/**
 * Derive the page's `http(s)` origin for the permission grant. The Clipboard API
 * requires a secure browsing context, so `about:blank` / `file:` / a malformed
 * URL is a deterministic caller error → non-retryable `ConfigError`.
 */
function secureOrigin(page: Page): string {
  const url = page.url();
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch (cause) {
    throw new ConfigError(`clipboard requires an http(s) origin, got: ${url}`, {
      cause,
      context: { url },
    });
  }
  if (!origin.startsWith("http")) {
    throw new ConfigError(`clipboard requires an http(s) origin, got: ${url}`, {
      context: { url },
    });
  }
  return origin;
}

/** Read the page's clipboard text (grants `clipboard-read` on the page origin). */
export async function readClipboard(
  page: Page,
  opts: ClipboardOptions = {},
): Promise<string> {
  const origin = secureOrigin(page);
  opts.logger?.log("readClipboard", "step");
  try {
    const perms: Permission[] = ["clipboard-read"];
    await page.browserContext().overridePermissions(origin, perms);
    return await page.evaluate(() => {
      /* v8 ignore next -- runs in-browser inside Chromium; covered by the integration tier */
      return navigator.clipboard.readText();
    });
  } catch (cause) {
    throw new PptrKitError("readClipboard failed", {
      retryable: false,
      cause,
      context: { origin },
    });
  }
}

/** Write `text` to the page's clipboard (grants `clipboard-write` on the origin). */
export async function writeClipboard(
  page: Page,
  text: string,
  opts: ClipboardOptions = {},
): Promise<void> {
  const origin = secureOrigin(page);
  opts.logger?.log("writeClipboard", "step");
  try {
    const perms: Permission[] = ["clipboard-read", "clipboard-write"];
    await page.browserContext().overridePermissions(origin, perms);
    await page.evaluate((t: string) => {
      /* v8 ignore next -- runs in-browser inside Chromium; covered by the integration tier */
      return navigator.clipboard.writeText(t);
    }, text);
  } catch (cause) {
    throw new PptrKitError("writeClipboard failed", {
      retryable: false,
      cause,
      context: { origin },
    });
  }
}
