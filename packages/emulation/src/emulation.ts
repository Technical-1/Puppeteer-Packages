import { PptrKitError } from "@technical-1/core";
import type { LoggerOption } from "@technical-1/core";
import { KnownDevices } from "puppeteer-core";
import type { Device, Page, Viewport } from "puppeteer-core";

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

export async function emulateDevice(
  page: Page,
  target: EmulationTarget,
  options: EmulateDeviceOptions = {},
): Promise<void> {
  const { logger } = options;

  // Preset-name (string) branch is added in Task 4.

  if (isDevice(target as Device | Viewport)) {
    const device = target as Device;
    logger?.log("emulating custom device", "step");
    await applyDevice(page, device, "custom device");
    logger?.log("emulated custom device", "success");
    return;
  }

  const viewport = target as Viewport;
  logger?.log(`setting viewport ${viewport.width}x${viewport.height}`, "step");
  try {
    await page.setViewport(viewport);
  } catch (cause) {
    throw new PptrKitError("emulateDevice: setViewport failed", {
      retryable: true,
      cause,
      context: { viewport },
    });
  }
  logger?.log(`viewport set ${viewport.width}x${viewport.height}`, "success");
}
