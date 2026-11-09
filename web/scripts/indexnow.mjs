// Tell IndexNow engines (Bing and partners) about the sitemap URLs after a
// public deploy. The key is public by design and is served at /<key>.txt.
import { pathToFileURL } from "node:url";

export const INDEXNOW_KEY = "34a5c191bb7188b496c474f0f9264e9c";

export function indexNowPayload(sitemapXml, origin) {
  const { host } = new URL(origin);
  const urlList = [...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => new URL(url).host === host);
  return {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${new URL(origin).origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

// A freshly deployed key file can be rejected (403) until engines see it.
export async function submitIndexNow(
  origin,
  {
    fetch: get = fetch,
    wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  const key = await get(`${origin}/${INDEXNOW_KEY}.txt`);
  if (!key.ok || (await key.text()).trim() !== INDEXNOW_KEY)
    throw new Error("IndexNow key file is not served");
  const sitemap = await get(`${origin}/sitemap.xml`);
  if (!sitemap.ok) throw new Error(`sitemap.xml: HTTP ${sitemap.status}`);
  const payload = indexNowPayload(await sitemap.text(), origin);
  if (!payload.urlList.length) throw new Error("No sitemap URLs");
  for (let attempt = 1; ; attempt++) {
    const response = await get("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    // 200 and 202 both mean accepted.
    if (response.ok) break;
    if (response.status !== 403 || attempt >= 5)
      throw new Error(`IndexNow: HTTP ${response.status}`);
    await wait(30_000);
  }
  console.log(`IndexNow accepted ${payload.urlList.length} URLs`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origin = process.env.PUBLIC_ORIGIN;
  if (!origin) throw new Error("PUBLIC_ORIGIN is required");
  await submitIndexNow(origin.replace(/\/$/, ""));
}
