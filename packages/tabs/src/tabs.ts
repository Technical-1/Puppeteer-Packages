import type { Browser, Page, Target } from "puppeteer-core";
import { PptrKitError, TimeoutError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface WaitForNewPageOptions extends LoggerOption {
  /** Max time to wait for the new page target (ms). Default 30000. */
  timeout?: number;
}

/**
 * Subscribe to `browser.on('targetcreated')`, run `trigger`, and resolve the
 * first new target for which `match` returns true, as a `Page`.
 *
 * The listener and timeout timer are installed synchronously (before the
 * `await trigger()`), so a popup that opens during the trigger is never missed.
 * `cleanup()` runs on every exit — success, timeout, predicate-miss, and
 * trigger failure — so neither the listener nor the timer can leak.
 */
async function awaitNewPage(
  browser: Browser,
  trigger: () => Promise<void> | void,
  match: (target: Target) => boolean,
  timeout: number,
  label: string,
): Promise<Page> {
  let onCreated!: (target: Target) => void;
  let timer!: ReturnType<typeof setTimeout>;

  const settled = new Promise<Page>((resolve, reject) => {
    onCreated = (target: Target): void => {
      let ok: boolean;
      try {
        ok = match(target);
      } catch {
        return; // a throwing predicate/url() call just skips this target
      }
      if (!ok) return;
      target.page().then(
        (page) => {
          if (page) resolve(page); // null => not a real page target; keep waiting
        },
        (cause: unknown) => {
          reject(
            new PptrKitError(`${label}: failed to resolve new page target`, {
              retryable: false,
              cause,
            }),
          );
        },
      );
    };
    browser.on("targetcreated", onCreated);

    timer = setTimeout(() => {
      reject(
        new TimeoutError(`${label}: no matching new page within ${timeout}ms`, {
          context: { timeout },
        }),
      );
    }, timeout);
  });

  const cleanup = (): void => {
    browser.off("targetcreated", onCreated);
    clearTimeout(timer);
  };

  try {
    await trigger();
  } catch (cause) {
    cleanup();
    throw new PptrKitError(`${label}: trigger threw`, { retryable: false, cause });
  }

  try {
    return await settled;
  } finally {
    cleanup();
  }
}

/**
 * Race `trigger` (e.g. a click that calls `window.open`) against the browser's
 * `'targetcreated'` event and return the first new page's `Page`, with a typed
 * timeout and guaranteed listener cleanup.
 *
 * Throws a core `TimeoutError` (`retryable: true`) if no page target appears in
 * time, or a core `PptrKitError` (`retryable: false`) if the trigger throws or
 * the target's page cannot be resolved.
 */
export async function waitForNewPage(
  browser: Browser,
  trigger: () => Promise<void> | void,
  opts: WaitForNewPageOptions = {},
): Promise<Page> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  opts.logger?.log("waiting for new page/tab", "step");
  const page = await awaitNewPage(
    browser,
    trigger,
    (target) => target.type() === "page",
    timeout,
    "waitForNewPage",
  );
  opts.logger?.log("new page/tab settled", "success");
  return page;
}

export interface WaitForPageMatchingOptions extends WaitForNewPageOptions {}

/**
 * Like {@link waitForNewPage}, but resolves only the first new page target
 * whose target URL satisfies `urlPredicate`. Non-matching page targets (e.g. an
 * ad/analytics popup) are ignored until one matches or the timeout fires. A
 * `urlPredicate` or `target.url()` that throws simply skips that target.
 */
export async function waitForPageMatching(
  browser: Browser,
  trigger: () => Promise<void> | void,
  urlPredicate: (url: string) => boolean,
  opts: WaitForPageMatchingOptions = {},
): Promise<Page> {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  opts.logger?.log("waiting for matching new page/tab", "step");
  const page = await awaitNewPage(
    browser,
    trigger,
    (target) => target.type() === "page" && urlPredicate(target.url()),
    timeout,
    "waitForPageMatching",
  );
  opts.logger?.log("matching page/tab settled", "success");
  return page;
}
