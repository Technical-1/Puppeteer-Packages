import { describe, it, expect } from "vitest";
import * as authFlow from "./index.js";

describe("public surface", () => {
  it("exposes login only", () => {
    expect(typeof authFlow.login).toBe("function");
    expect(Object.keys(authFlow).sort()).toEqual(["login"]);
  });
});
