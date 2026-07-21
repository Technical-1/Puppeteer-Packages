import { ConfigError, PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import { KnownDevices } from "puppeteer-core";
import type { BrowserContext, Device, Page, Permission, Viewport } from "puppeteer-core";

/** Names of the device presets shipped by the installed `puppeteer-core`. */
export type KnownDeviceName = keyof typeof KnownDevices;

/**
 * What to emulate:
 * - a `KnownDevices` preset name (e.g. `"iPhone 15 Pro"`) — applied via `page.emulate`;
 * - a full `Device` (`{ userAgent, viewport }`) — applied via `page.emulate`;
 * - a bare `Viewport` (`{ width, height, deviceScaleFactor?, isMobile?, hasTouch?,
 *   isLandscape? }`) — applied via `page.setViewport`.
 */
export type EmulationTarget = KnownDeviceName | Device | Viewport;

/**
 * Options for {@link emulateDevice}.
 *
 * This is the extension point for the 1.x override axes (permissions, geolocation,
 * media features/type, CPU throttling) — deferred to Plan 22. Do NOT add those fields
 * in the 0.x line; they belong to a separate, opt-in surface.
 */
export interface EmulateDeviceOptions extends LoggerOption {}

/** Narrows to a full `Device` (`{ userAgent, viewport }`) as opposed to a bare `Viewport`. */
function isDevice(target: Device | Viewport): target is Device {
  return "userAgent" in target;
}

/** Apply a full Device (UA + viewport) via page.emulate, wrapping failures. */
async function applyDevice(page: Page, device: Device, label: string): Promise<void> {
  try {
    await page.emulate(device);
  } catch (cause) {
    throw new PptrKitError(`emulateDevice: page.emulate failed (${label})`, {
      retryable: true,
      cause,
      context: { device: label },
    });
  }
}

/**
 * Emulate a device, custom device, or viewport on `page`.
 *
 * - Pass a `KnownDevices` preset name (e.g. `"iPhone 15 Pro"`) or a full `Device`
 *   (`{ userAgent, viewport }`) to apply UA + viewport together via `page.emulate`.
 * - Pass a bare `Viewport` (`{ width, height, deviceScaleFactor?, isMobile?, hasTouch?,
 *   isLandscape? }`) to set just the viewport via `page.setViewport`.
 *
 * Throws `PptrKitError` `retryable:false` for an unknown preset name (deterministic caller
 * error). Wraps a `page.emulate` / `page.setViewport` rejection as `PptrKitError`
 * `retryable:true` carrying the original as `cause`.
 */
export async function emulateDevice(
  page: Page,
  target: EmulationTarget,
  options: EmulateDeviceOptions = {},
): Promise<void> {
  const { logger } = options;

  if (typeof target === "string") {
    // noUncheckedIndexedAccess makes this Device | undefined only if we widen the key;
    // widen explicitly so an out-of-catalog name (from a caller cast) is caught at runtime.
    const device = (KnownDevices as Record<string, Device | undefined>)[target];
    if (device === undefined) {
      throw new PptrKitError(`Unknown device preset: ${target}`, {
        retryable: false,
        context: { device: target },
      });
    }
    logger?.log(`emulating device preset ${target}`, "step");
    await applyDevice(page, device, target);
    logger?.log(`emulated device preset ${target}`, "success");
    return;
  }

  if (isDevice(target)) {
    logger?.log("emulating custom device", "step");
    await applyDevice(page, target, "custom device");
    logger?.log("emulated custom device", "success");
    return;
  }

  logger?.log(`setting viewport ${target.width}x${target.height}`, "step");
  try {
    await page.setViewport(target);
  } catch (cause) {
    throw new PptrKitError("emulateDevice: setViewport failed", {
      retryable: true,
      cause,
      context: { viewport: target },
    });
  }
  logger?.log(`viewport set ${target.width}x${target.height}`, "success");
}

/** The device preset names available in the installed `puppeteer-core`. */
export function listKnownDevices(): KnownDeviceName[] {
  return Object.keys(KnownDevices) as KnownDeviceName[];
}

/** A permission grantable via `browserContext.overridePermissions`. */
export type PermissionName = Permission;

/** Options for {@link overridePermissions}. */
export interface OverridePermissionsOptions extends LoggerOption {
  /**
   * The origin to grant permissions for. Required when `target` is a `BrowserContext`.
   * When `target` is a `Page`, defaults to the page's current origin (derived from
   * `page.url()`) if omitted.
   */
  origin?: string;
}

/** Narrows to a `BrowserContext` as opposed to a `Page`. */
function isBrowserContext(target: BrowserContext | Page): target is BrowserContext {
  return typeof (target as BrowserContext).overridePermissions === "function";
}

/** Derive the origin from a page's current URL, or `undefined` if it has none (e.g. about:blank). */
function deriveOrigin(page: Page): string | undefined {
  try {
    const origin = new URL(page.url()).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

/** Resolve the `BrowserContext` and effective origin from a `BrowserContext | Page` target. */
function resolveContextAndOrigin(
  target: BrowserContext | Page,
  origin: string | undefined,
): { context: BrowserContext; origin: string } {
  if (isBrowserContext(target)) {
    if (origin === undefined) {
      throw new ConfigError(
        "overridePermissions: an `origin` is required when passing a BrowserContext",
        { context: { reason: "missing-origin" } },
      );
    }
    return { context: target, origin };
  }
  const resolved = origin ?? deriveOrigin(target);
  if (resolved === undefined) {
    throw new ConfigError(
      "overridePermissions: could not derive an origin from the page; pass `origin` explicitly",
      { context: { url: target.url() } },
    );
  }
  return { context: target.browserContext(), origin: resolved };
}

/**
 * Grant a set of browser permissions (camera, microphone, geolocation, notifications,
 * clipboard, etc.) on a `BrowserContext` or on the context owning a `Page`.
 *
 * - Pass a `BrowserContext` — an `origin` is required in `options`.
 * - Pass a `Page` — `origin` defaults to the page's current origin when omitted.
 *
 * Throws `ConfigError` (`retryable:false`) for an empty `permissions` list, a missing
 * `origin` when `target` is a `BrowserContext`, or an origin that cannot be derived from
 * the page (e.g. `about:blank`). Wraps a `browserContext.overridePermissions` rejection as
 * `PptrKitError` `retryable:true` carrying the original as `cause`.
 */
export async function overridePermissions(
  target: BrowserContext | Page,
  permissions: readonly PermissionName[],
  options: OverridePermissionsOptions = {},
): Promise<void> {
  const { logger, origin } = options;
  if (permissions.length === 0) {
    throw new ConfigError("overridePermissions: `permissions` must not be empty", {
      context: { reason: "empty-permissions" },
    });
  }
  const { context, origin: resolvedOrigin } = resolveContextAndOrigin(target, origin);
  logger?.log(`granting ${permissions.length} permission(s) for ${resolvedOrigin}`, "step");
  try {
    await context.overridePermissions(resolvedOrigin, [...permissions]);
  } catch (cause) {
    throw new PptrKitError("overridePermissions: browserContext.overridePermissions failed", {
      retryable: true,
      cause,
      context: { origin: resolvedOrigin, permissions: [...permissions] },
    });
  }
  logger?.log(`granted ${permissions.length} permission(s) for ${resolvedOrigin}`, "success");
}
