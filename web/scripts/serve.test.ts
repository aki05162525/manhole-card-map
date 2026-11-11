import { afterEach, beforeEach, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  gunzipSync,
} from "node:zlib";

let root: string;
let server: ChildProcess;
let origin: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "issue8-http-"));
  // Report the actual OS-assigned port without reserving a port or touching 4180.
  server = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import { Server } from 'node:http';
    const listen = Server.prototype.listen;
    Server.prototype.listen = function (...args) {
      this.once('listening', () => process.send(this.address()));
      return listen.apply(this, args);
    };
    await import(${JSON.stringify(pathToFileURL(resolve("scripts/serve.mjs")).href)});
  `,
    ],
    {
      env: { ...process.env, PORT: "0", SERVE_DIR: root },
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    },
  );
  const address = await new Promise<{ address: string; port: number }>(
    (resolveAddress, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Server startup timed out")),
        5000,
      );
      server.once("message", (value) => {
        clearTimeout(timeout);
        resolveAddress(value as { address: string; port: number });
      });
      server.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      server.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited: ${code}`));
      });
    },
  );
  expect(address.address).toBe("127.0.0.1");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (root) await rm(root, { recursive: true, force: true });
});
async function put(path: string, body: string | Buffer) {
  await mkdir(resolve(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), body);
}
async function request(path: string, headers: Record<string, string> = {}) {
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: Buffer;
  }>((resolveResponse, reject) => {
    get(origin + path, { headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () =>
        resolveResponse({
          status: response.statusCode!,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
    }).on("error", reject);
  });
}

it.each([
  "index.html",
  "cards.json",
  "data/full.json",
  "split/14.json",
  "map-style.json",
  "assets/plain.js",
])("revalidates mutable %s before reuse", async (path) => {
  await put(path, "old");
  const first = await request("/" + path);
  // A deterministic cache client: fresh max-age entries bypass HTTP entirely.
  const fresh = /max-age=(\d+)/.exec(String(first.headers["cache-control"]));
  await put(path, "new");
  const next =
    fresh && Number(fresh[1]) > 0 ? first : await request("/" + path);
  expect(next.body.toString()).toBe("new");
  expect(first.headers["cache-control"]).toBe("no-cache");
});
it.each([
  "assets/index-Ab12_cd3.js",
  "assets/index-Ab12_cd3.css",
  "data-v/0123456789abcdef/full.json",
])("keeps hashed asset %s immutable", async (path) => {
  await put(path, "asset");
  expect((await request("/" + path)).headers["cache-control"]).toBe(
    "public,max-age=31536000,immutable",
  );
});
it.each(["br", "gzip"])(
  "rejects stale %s sidecars even with newer timestamps",
  async (encoding) => {
    const compress = encoding === "br" ? brotliCompressSync : gzipSync;
    const decompress = encoding === "br" ? brotliDecompressSync : gunzipSync;
    await put("cards.json", "new");
    const sidecar = `cards.json.${encoding === "br" ? "br" : "gz"}`;
    await put(sidecar, compress(Buffer.from("old")));
    await utimes(join(root, sidecar), 2000000000, 2000000000);
    const response = await request("/cards.json", {
      "Accept-Encoding": encoding,
    });
    expect(response.headers["content-encoding"]).toBe(encoding);
    expect(response.headers.vary).toBe("Accept-Encoding");
    expect(decompress(response.body).toString()).toBe("new");
  },
);
it.each(["identity", "br", "gzip"])(
  "invalidates %s memory cache when size and mtime are unchanged",
  async (encoding) => {
    await put("cards.json", "old");
    await utimes(join(root, "cards.json"), 1700000000, 1700000000);
    const before = await stat(join(root, "cards.json"));
    await request("/cards.json", { "Accept-Encoding": encoding });
    await put("cards.json", "new");
    await utimes(join(root, "cards.json"), before.atime, before.mtime);
    expect((await stat(join(root, "cards.json"))).mtimeMs).toBe(before.mtimeMs);
    const response = await request("/cards.json", {
      "Accept-Encoding": encoding,
    });
    const body =
      encoding === "br"
        ? brotliDecompressSync(response.body)
        : encoding === "gzip"
          ? gunzipSync(response.body)
          : response.body;
    expect(body.toString()).toBe("new");
  },
);
it.each(["br", "gzip"])(
  "uses valid %s sidecars, then replaces them when source changes",
  async (encoding) => {
    const compress = encoding === "br" ? brotliCompressSync : gzipSync;
    const decompress = encoding === "br" ? brotliDecompressSync : gunzipSync;
    const sidecar = compress(Buffer.from("old"));
    await put("cards.json", "old");
    await put(`cards.json.${encoding === "br" ? "br" : "gz"}`, sidecar);
    const headers = { "Accept-Encoding": encoding };
    expect((await request("/cards.json", headers)).body).toEqual(sidecar);
    await put("cards.json", "new contents");
    expect(
      decompress((await request("/cards.json", headers)).body).toString(),
    ).toBe("new contents");
  },
);
it.each(["br", "gzip"])(
  "falls back from corrupt %s sidecars",
  async (encoding) => {
    await put("cards.json", "current");
    await put(
      `cards.json.${encoding === "br" ? "br" : "gz"}`,
      "not compressed",
    );
    const response = await request("/cards.json", {
      "Accept-Encoding": encoding,
    });
    expect(response.status).toBe(200);
    const decompress = encoding === "br" ? brotliDecompressSync : gunzipSync;
    expect(decompress(response.body).toString()).toBe("current");
  },
);
it("revalidates the root document and keeps missing files as 404", async () => {
  await put("index.html", "document");
  const response = await request("/");
  expect(response.body.toString()).toBe("document");
  expect(response.headers["cache-control"]).toBe("no-cache");
  expect((await request("/missing.json")).status).toBe(404);
});
