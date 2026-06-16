import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  let requestPath = pathname === "/" ? "/app/index.html" : pathname;
  if (requestPath === "/app" || requestPath === "/app/") {
    requestPath = "/app/index.html";
  }
  const fullPath = resolve(rootDir, `.${requestPath}`);
  if (fullPath !== rootDir && !fullPath.startsWith(`${rootDir}${sep}`)) {
    return null;
  }
  return fullPath;
}

const server = createServer(async (request, response) => {
  const fullPath = resolveRequestPath(request.url || "/");
  if (!fullPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(fullPath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(fullPath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Gunpula app running at http://localhost:${port}/app/`);
});
