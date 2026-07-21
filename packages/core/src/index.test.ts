import { describe, it, expect } from "vitest";
import * as core from "./index.js";

describe("public surface", () => {
  it("exposes exactly the runtime exports the suite locks", () => {
    expect(Object.keys(core).sort()).toEqual(
      [
        "LOG_LEVELS",
        "PptrKitError",
        "SelectorNotFoundError",
        "NavigationError",
        "TimeoutError",
        "CaptchaError",
        "ProxyError",
        "SessionError",
        "ConfigError",
        "PoolError",
        "ContextError",
        "DownloadError",
        "NetworkError",
        "WorkerError",
        "CdpError",
        "AbortError",
      ].sort(),
    );
  });
});
