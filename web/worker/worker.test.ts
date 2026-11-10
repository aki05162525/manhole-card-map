import { brotliCompressSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { data, pages, startWorker } from "./test-harness";

type Running = Awaited<ReturnType<typeof startWorker>>;

// wrangler types its own Response; only the headers matter here.
const expectApiHeaders = (response: {
  headers: Pick<Headers, "get" | "has">;
}) => {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
};

// Static pages must behave exactly as before the Worker script existed.
const expectUnchangedAssets = (running: () => Running) => {
  test.each([
    ["/", pages["index.html"]],
    ["/cards", pages["cards.html"]],
  ])("serves %s from assets", async (path, body) => {
    const response = await running().harness.fetch(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });
  test("keeps the canonical redirect for .html", async () => {
    const response = await running().harness.fetch("/cards.html", {
      redirect: "manual",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/cards");
  });
  test.each(["/__missing__", "/api", "/apix/health"])(
    "answers %s with the 404 page",
    async (path) => {
      const response = await running().harness.fetch(path);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe(pages["404.html"]);
    },
  );
};

// Miniflare decodes the body and reports the Content-Encoding here. It
// re-encodes for the client's first listed coding, so these requests list br
// alone; data.test.ts covers browsers' own Accept-Encoding headers.
const encoding = (response: { headers: Pick<Headers, "get"> }) =>
  response.headers.get("mf-content-encoding");

// Cloudflare's own Brotli is far weaker than prepare.mjs's quality 11, so the
// Worker hands card data over in the build's compressed copy.
const expectPrecompressedData = (running: () => Running) => {
  test("serves card data from its Brotli copy", async () => {
    const response = await running().harness.fetch("/data/full.json", {
      headers: { "Accept-Encoding": "br" },
    });
    expect(response.status).toBe(200);
    expect(encoding(response)).toBe("br");
    expect(response.headers.get("content-length")).toBe(
      String(brotliCompressSync(data).length),
    );
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("vary")).toContain("Accept-Encoding");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(data);
  });
  test("revalidates the Brotli copy", async () => {
    const headers = { "Accept-Encoding": "br" };
    const first = await running().harness.fetch("/data/full.json", {
      headers,
    });
    await first.arrayBuffer();
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const again = await running().harness.fetch("/data/full.json", {
      headers: { ...headers, "If-None-Match": etag! },
    });
    expect(again.status).toBe(304);
  });
  test("serves card data uncompressed without Brotli support", async () => {
    const response = await running().harness.fetch("/data/full.json", {
      headers: { "Accept-Encoding": "identity" },
    });
    expect(response.status).toBe(200);
    expect(encoding(response)).toBeNull();
    expect(response.headers.get("vary")).toContain("Accept-Encoding");
    expect(await response.text()).toBe(data);
  });
  test("answers missing card data with the 404 page", async () => {
    const response = await running().harness.fetch("/data/missing.json", {
      headers: { "Accept-Encoding": "br" },
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(pages["404.html"]);
  });
};

describe("production config with D1", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker();
  });
  afterAll(() => running.close());

  expectUnchangedAssets(() => running);
  expectPrecompressedData(() => running);
  test("reports health from the production D1 binding", async () => {
    const response = await running.harness.fetch("/api/health");
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("local config with D1", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker({ dev: true });
  });
  afterAll(() => running.close());

  expectUnchangedAssets(() => running);
  test("reports health after querying D1", async () => {
    const response = await running.harness.fetch("/api/health");
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(await response.json()).toEqual({ ok: true });
  });
  test("answers an unknown API path with a JSON 404", async () => {
    const response = await running.harness.fetch("/api/__missing__");
    expect(response.status).toBe(404);
    expectApiHeaders(response);
  });
  test("rejects an unsupported method without CORS", async () => {
    const response = await running.harness.fetch("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expectApiHeaders(response);
  });
});

describe("emergency stop", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker({
      dev: true,
      secrets: { API_DISABLED: "1" },
    });
  });
  afterAll(() => running.close());

  test("answers every API path with 503", async () => {
    for (const path of ["/api/health", "/api/__missing__"]) {
      const response = await running.harness.fetch(path);
      expect(response.status).toBe(503);
      expectApiHeaders(response);
      expect(await response.json()).toEqual({ error: "api_disabled" });
    }
  });
  expectUnchangedAssets(() => running);
  expectPrecompressedData(() => running);
});
