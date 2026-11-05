// 外部公開しないループバック専用サーバー。PMTiles の Range と圧縮を扱う。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
const root = resolve(process.env.SERVE_DIR || "dist");
const port = Number(process.env.PORT || 4173);
const compressed = new Map();
createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." +
        decodeURIComponent(
          new URL(req.url, "http://localhost").pathname.replace(
            /\/$/,
            "/index.html",
          ),
        ),
    );
    if (!path.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(path),
      ext = extname(path);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".geojson": "application/geo+json",
        ".pbf": "application/x-protobuf",
        ".png": "image/png",
        ".pmtiles": "application/octet-stream",
      }[ext] || "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      path.endsWith("sw.js") ? "no-cache" : "public,max-age=3600",
    );
    res.setHeader("Timing-Allow-Origin", "*");
    if (ext === ".pmtiles") {
      res.setHeader("Accept-Ranges", "bytes");
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start = Number(range[1]),
          end = Math.min(
            range[2] ? Number(range[2]) : info.size - 1,
            info.size - 1,
          );
        if (start > end || start >= info.size) {
          res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
          return;
        }
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Content-Length": end - start + 1,
        });
        createReadStream(path, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { "Content-Length": info.size });
        createReadStream(path).pipe(res);
      }
      return;
    }
    const encoding = /\bbr\b/.test(req.headers["accept-encoding"] || "")
      ? "br"
      : /\bgzip\b/.test(req.headers["accept-encoding"] || "")
        ? "gzip"
        : "";
    const key = path + info.mtimeMs + encoding;
    let body = compressed.get(key);
    if (!body) {
      try {
        body = await readFile(
          path + (encoding === "br" ? ".br" : encoding === "gzip" ? ".gz" : ""),
        );
      } catch {
        body = await readFile(path);
        if (encoding)
          body = encoding === "br" ? brotliCompressSync(body) : gzipSync(body);
      }
      compressed.set(key, body);
    }
    res.setHeader("Vary", "Accept-Encoding");
    if (encoding) res.setHeader("Content-Encoding", encoding);
    res.writeHead(200, { "Content-Length": body.length });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`http://127.0.0.1:${port} （ローカル専用: ${root}）`),
);
