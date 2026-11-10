// Static Assets compress on the fly at a low Brotli level: full.json arrived
// as 486 kB on 2026-11-10 against 266 kB for prepare.mjs's quality-11 copy.
// Card data (/data/*) is therefore served from that copy here.
export interface Assets {
  fetch(request: Request): Promise<Response>;
}

const acceptsBrotli = (header: string | null) =>
  (header ?? "").split(",").some((part) => {
    const [name = "", ...params] = part.split(";");
    return (
      name.trim().toLowerCase() === "br" &&
      !params.some((param) => /^\s*q=0(\.0*)?\s*$/.test(param))
    );
  });

export async function serveData(request: Request, assets: Assets) {
  const url = new URL(request.url);
  if (
    url.pathname.endsWith(".json") &&
    acceptsBrotli(request.headers.get("Accept-Encoding"))
  ) {
    const copy = new URL(url);
    copy.pathname += ".br";
    const compressed = await assets.fetch(new Request(copy, request));
    if (compressed.status === 200 || compressed.status === 304) {
      const response = new Response(compressed.body, {
        status: compressed.status,
        headers: compressed.headers,
        // Pass the bytes through; the runtime must not encode them again.
        encodeBody: "manual",
      } as ResponseInit);
      if (compressed.status === 200) {
        response.headers.set("Content-Type", "application/json; charset=utf-8");
        response.headers.set("Content-Encoding", "br");
      }
      return withDataHeaders(response);
    }
  }
  const response = await assets.fetch(request);
  return withDataHeaders(new Response(response.body, response));
}

function withDataHeaders(response: Response) {
  response.headers.append("Vary", "Accept-Encoding");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
