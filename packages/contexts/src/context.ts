import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Permission,
  Target,
} from "puppeteer-core";
import { ContextError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import type { IsolatedContextOptions, TargetInfo } from "./types.js";

/** Close a context without ever throwing; a close failure is only logged. */
async function closeQuietly(
  context: BrowserContext,
  opts: LoggerOption,
): Promise<void> {
  try {
    await context.close();
    opts.logger?.log("contexts: context closed", "info");
  } catch (closeErr) {
    opts.logger?.log(
      `contexts: context close failed: ${
        closeErr instanceof Error ? closeErr.message : String(closeErr)
      }`,
      "warn",
    );
  }
}

/**
 * Create an isolated (incognito-style) BrowserContext. Optionally sets a
 * per-context proxy and applies permission overrides. If applying permissions
 * fails, the just-created context is closed quietly before the error is thrown
 * so no orphan context leaks.
 */
export async function createIsolatedContext(
  browser: Browser,
  opts: IsolatedContextOptions = {},
): Promise<BrowserContext> {
  opts.logger?.log("contexts: creating isolated context", "step");

  const options: BrowserContextOptions = {};
  if (opts.proxyServer !== undefined) options.proxyServer = opts.proxyServer;
  if (opts.proxyBypassList !== undefined) {
    options.proxyBypassList = opts.proxyBypassList;
  }

  let context: BrowserContext;
  try {
    context = await browser.createBrowserContext(options);
  } catch (cause) {
    throw new ContextError("contexts: failed to create browser context", {
      retryable: true,
      cause,
      context: { proxyServer: opts.proxyServer },
    });
  }

  const grants = opts.permissions ?? [];
  for (const grant of grants) {
    try {
      await context.overridePermissions(grant.origin, grant.permissions);
    } catch (cause) {
      await closeQuietly(context, opts);
      throw new ContextError(
        `contexts: failed to override permissions for ${grant.origin}`,
        { retryable: true, cause, context: { origin: grant.origin } },
      );
    }
  }

  opts.logger?.log(
    `contexts: isolated context created (${grants.length} permission grants)`,
    "success",
  );
  return context;
}

/**
 * Enumerate a context's targets as flat, typed rows. Synchronous — mirrors
 * puppeteer-core's synchronous `BrowserContext.targets()`.
 */
export function listContextTargets(context: BrowserContext): TargetInfo[] {
  try {
    return context.targets().map((t: Target) => ({ type: t.type(), url: t.url() }));
  } catch (cause) {
    throw new ContextError("contexts: failed to enumerate context targets", {
      retryable: true,
      cause,
    });
  }
}

/**
 * Grant `permissions` to `origin` on `context` (full-replace: Chrome auto-denies
 * anything not listed). For per-permission granted/denied/prompt state, use
 * puppeteer-core's `BrowserContext.setPermission` directly.
 */
export async function overridePermissions(
  context: BrowserContext,
  origin: string,
  permissions: Permission[],
  opts: LoggerOption = {},
): Promise<void> {
  opts.logger?.log(`contexts: overriding permissions for ${origin}`, "step");
  try {
    await context.overridePermissions(origin, permissions);
  } catch (cause) {
    throw new ContextError(
      `contexts: failed to override permissions for ${origin}`,
      { retryable: true, cause, context: { origin } },
    );
  }
  opts.logger?.log(`contexts: overrode permissions for ${origin}`, "success");
}

/** Clear all permission overrides on `context`. */
export async function clearContextPermissions(
  context: BrowserContext,
  opts: LoggerOption = {},
): Promise<void> {
  opts.logger?.log("contexts: clearing permission overrides", "step");
  try {
    await context.clearPermissionOverrides();
  } catch (cause) {
    throw new ContextError("contexts: failed to clear permission overrides", {
      retryable: true,
      cause,
    });
  }
  opts.logger?.log("contexts: cleared permission overrides", "success");
}

export { closeQuietly };
