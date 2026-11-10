// LINE's in-app browser cannot use passkeys. This query asks LINE to reopen
// the page in the default browser; the fragment carries over on redirect.
const param = "openExternalBrowser";

export function openInDefaultBrowser(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  if (!/\bLine\//.test(request.headers.get("User-Agent") ?? ""))
    return undefined;
  const url = new URL(request.url);
  // Once asked, serve the page even if LINE stayed, so it never loops.
  if (url.searchParams.has(param)) return undefined;
  url.searchParams.set(param, "1");
  return new Response(null, {
    status: 302,
    headers: { Location: url.href, "Cache-Control": "no-store" },
  });
}
