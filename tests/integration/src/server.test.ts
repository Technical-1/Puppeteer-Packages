import { describe, it, expect } from "vitest";
import { startServer } from "./server.js";

describe("fixture server", () => {
  it("serves index.html on /", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("<html");
    await s.close();
  });

  it("serves /download/sample.bin as attachment", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/download/sample.bin`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-length")).toBe("1024");
    await s.close();
  });

  it("404s unknown paths", async () => {
    const s = await startServer();
    const res = await fetch(`${s.baseUrl}/missing.html`);
    expect(res.status).toBe(404);
    await s.close();
  });
});
