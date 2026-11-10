import { describe, expect, it, vi } from "vitest";
import { serveData } from "./data";

const assets = (files: Record<string, string>) => ({
  fetch: vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    return path in files
      ? new Response(files[path], { headers: { ETag: '"a"' } })
      : new Response("missing", { status: 404 });
  }),
});
const request = (path: string, encoding: string) =>
  new Request(`https://manhole-techo.com${path}`, {
    headers: { "Accept-Encoding": encoding },
  });
const files = { "/data/full.json": "{}", "/data/full.json.br": "brotli" };

describe("card data", () => {
  it.each(["gzip, deflate, br, zstd", "br;q=1, gzip;q=0.5", "BR"])(
    "takes the Brotli copy for %s",
    async (encoding) => {
      const response = await serveData(
        request("/data/full.json", encoding),
        assets(files),
      );
      expect(response.headers.get("content-encoding")).toBe("br");
      expect(await response.text()).toBe("brotli");
    },
  );
  it.each(["gzip, deflate", "br;q=0, gzip", "brotli", ""])(
    "keeps the original for %j",
    async (encoding) => {
      const response = await serveData(
        request("/data/full.json", encoding),
        assets(files),
      );
      expect(response.headers.get("content-encoding")).toBeNull();
      expect(await response.text()).toBe("{}");
    },
  );
  it("falls back to the original when the copy is missing", async () => {
    const response = await serveData(
      request("/data/pins.json", "br"),
      assets({ "/data/pins.json": "[]" }),
    );
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(await response.text()).toBe("[]");
  });
  it("forwards revalidation headers to the copy", async () => {
    const binding = assets(files);
    await serveData(
      new Request("https://manhole-techo.com/data/full.json", {
        headers: { "Accept-Encoding": "br", "If-None-Match": '"a"' },
      }),
      binding,
    );
    const forwarded = binding.fetch.mock.calls[0]![0];
    expect(new URL(forwarded.url).pathname).toBe("/data/full.json.br");
    expect(forwarded.headers.get("if-none-match")).toBe('"a"');
  });
});
