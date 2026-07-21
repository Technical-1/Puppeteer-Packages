import type { LoggerOption } from "@technical-1/core";
import type { Permission } from "puppeteer-core";

/** A permission grant applied to a context for one origin. */
export interface ContextPermissionGrant {
  /** e.g. "https://example.com". */
  origin: string;
  /** Permissions to grant; any not listed are auto-denied by Chrome. */
  permissions: Permission[];
}

/** Options for {@link createIsolatedContext} / {@link withContext}. */
export interface IsolatedContextOptions extends LoggerOption {
  /** Per-context proxy, e.g. "http://host:8080". Credentials go via Page.authenticate. */
  proxyServer?: string;
  /** Hosts that bypass `proxyServer`. */
  proxyBypassList?: string[];
  /** Permission overrides applied immediately after the context is created. */
  permissions?: ContextPermissionGrant[];
}

/** A flattened, typed view of one target inside a context. */
export interface TargetInfo {
  /** The target type string (page, background_page, service_worker, …). */
  type: string;
  /** The target URL. */
  url: string;
}
