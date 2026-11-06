// 外部公開しないループバック専用サーバー。HTTP キャッシュの再検証と圧縮を扱う。
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, relative } from "node:path";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  gunzipSync,
} from "node:zlib";
const root = resolve(process.env.SERVE_DIR || "dist");
const port = Number(process.env.PORT || 4173);
const compressed = new Map();
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/legacy.html") {
      url.searchParams.delete("engine");
      res
        .writeHead(302, {
          Location: "/" + url.search,
          "Cache-Control": "no-cache",
        })
        .end();
      return;
    }
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
    const ext = extname(path);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".geojson": "application/geo+json",
        ".pbf": "application/x-protobuf",
        ".png": "image/png",
      }[ext] || "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      // Vite emits content-hashed assets here. Stable URLs must reach the
      // server again, including HTML, full/split data and unversioned workers.
      /^assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|png|jpe?g|svg|webp|avif)$/.test(
        relative(root, path),
      )
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    );
    res.setHeader("Timing-Allow-Origin", "*");
    const encoding = /\bbr\b/.test(req.headers["accept-encoding"] || "")
      ? "br"
      : /\bgzip\b/.test(req.headers["accept-encoding"] || "")
        ? "gzip"
        : "";
    // Read current bytes even when size/mtime are preserved by a deployment.
    // Keep only one source generation per path, rather than every old mtime.
    const source = await readFile(path);
    let cached = compressed.get(path);
    if (!cached || !cached.source.equals(source)) {
      cached = { source, encodings: new Map() };
      compressed.set(path, cached);
    }
    let body = source;
    if (encoding) {
      body = cached.encodings.get(encoding);
      if (!body) {
        try {
          const sidecar = await readFile(
            path + (encoding === "br" ? ".br" : ".gz"),
          );
          const decoded =
            encoding === "br"
              ? brotliDecompressSync(sidecar)
              : gunzipSync(sidecar);
          // Timestamps alone cannot prove that a copied sidecar is current.
          if (decoded.equals(source)) body = sidecar;
        } catch {
          // Missing/corrupt sidecars are equivalent to a cache miss.
        }
        body ||=
          encoding === "br" ? brotliCompressSync(source) : gzipSync(source);
        cached.encodings.set(encoding, body);
      }
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
