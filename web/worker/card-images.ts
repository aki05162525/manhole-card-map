// Card images that municipalities permitted (data/card-images.json), stored
// in KV under a name that holds a hash of the bytes, so each URL is immutable.
// The key shape matches cmd/builddata/card_images.go.
export const cardImagePrefix = "/card-images/";
const keyPattern = /^[0-9]{2}-[0-9]{3}-[A-Z][0-9]{3}-[0-9a-f]{16}\.webp$/;

export interface CardImageStore {
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
}
type WaitUntil = { waitUntil(promise: Promise<unknown>): void };
// Workers' default cache; absent outside workerd. On workers.dev (previews)
// it stores nothing, and every request reads KV.
const edgeCache = () =>
  (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export async function serveCardImage(
  request: Request,
  store: CardImageStore | undefined,
  context: WaitUntil,
) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  const url = new URL(request.url);
  const key = url.pathname.slice(cardImagePrefix.length);
  if (!store || !keyPattern.test(key)) return notFound();
  // Without the query, so a varied URL still costs no KV read.
  const cacheKey = new Request(url.origin + url.pathname);
  const cache = edgeCache();
  let response = await cache?.match(cacheKey);
  if (!response) {
    const body = await store.get(key, "arrayBuffer");
    if (!body) return notFound();
    response = new Response(body, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // The permission covers this site only: other sites may not embed it.
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
    if (cache) context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return request.method === "HEAD"
    ? new Response(null, { headers: response.headers })
    : response;
}
