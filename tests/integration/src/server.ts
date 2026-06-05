import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, sep } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "..", "fixtures");

export interface FixtureServer {
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startServer(port: number = 0): Promise<FixtureServer> {
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/download/sample.bin") {
        const body = Buffer.alloc(1024, 0x41); // 1 KB of 'A'
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="sample.bin"',
          "Content-Length": String(body.length),
        });
        res.end(body);
        return;
      }
      const fileName =
        url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const filePath = join(FIXTURES, fileName);
      if (filePath !== FIXTURES && !filePath.startsWith(FIXTURES + sep)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }
      const data = await readFile(filePath);
      const mimeMap: Record<string, string> = {
        html: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "text/javascript; charset=utf-8",
        json: "application/json; charset=utf-8",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        svg: "image/svg+xml",
      };
      const ext = extname(filePath).slice(1).toLowerCase();
      const type = mimeMap[ext] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": String(data.length),
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string")
    throw new Error("server.address() returned unexpected shape");
  const actualPort = addr.port;
  return {
    port: actualPort,
    baseUrl: `http://127.0.0.1:${actualPort}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
