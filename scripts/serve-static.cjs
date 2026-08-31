const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function createStaticServer() {
  return http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const filePath = path.resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  });
}

function startStaticServer(port = Number(process.env.PORT || 8765)) {
  const server = createStaticServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

module.exports = { startStaticServer };

if (require.main === module) {
  startStaticServer().then((server) => {
    process.stdout.write(`RC ORDERA test server: http://127.0.0.1:${server.address().port}\n`);
    const stop = () => {
      server.closeAllConnections?.();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 250).unref();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
