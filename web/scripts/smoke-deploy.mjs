import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
// Limited release must never rely on someone remembering Access: an anonymous
// visitor has to be stopped, not merely shown an empty or missing site.
export async function checkAccess(env = process.env, request = fetch) {
  if (!env.PUBLIC_ORIGIN) throw new Error("PUBLIC_ORIGIN is required");
  const origin = new URL(env.PUBLIC_ORIGIN);
  const response = await request(new URL("/", origin), {
    headers: {},
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const location = response.headers.get("location");
  const login =
    [301, 302, 303, 307, 308].includes(response.status) &&
    location &&
    new URL(location, origin).hostname.endsWith(".cloudflareaccess.com");
  if (!login && ![401, 403].includes(response.status))
    throw new Error("Access does not protect origin: " + response.status);
}
export async function smokeDeploy(env = process.env, request = fetch) {
  if (!env.PUBLIC_ORIGIN) throw new Error("PUBLIC_ORIGIN is required");
  const origin = new URL(env.PUBLIC_ORIGIN);
  if (env.ACCESS_REQUIRED === "true") {
    await checkAccess(env, request);
    // Without a service token the assets stay out of reach; a person checks them.
    if (!env.CF_ACCESS_CLIENT_ID && !env.CF_ACCESS_CLIENT_SECRET) return;
  }
  const headers = {};
  if (env.CF_ACCESS_CLIENT_ID || env.CF_ACCESS_CLIENT_SECRET) {
    if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET)
      throw new Error("Incomplete Access credentials");
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  for (const [path, status] of [
    ["/", 200],
    ["/cards.html", 200],
    ["/data/manifest.json", 200],
    ["/data/full.json", 200],
    ["/sw.js", 404],
    ["/data/quality.json", 404],
  ]) {
    const response = await request(new URL(path, origin), {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (response.status !== status)
      throw new Error(path + ": " + response.status);
    if (
      path === "/" &&
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("Expected HTML");
    if (
      path === "/data/manifest.json" &&
      !Buffer.from(await response.arrayBuffer()).equals(
        await readFile(
          resolve(env.DEPLOY_DIST || "dist", "data/manifest.json"),
        ),
      )
    )
      throw new Error("Manifest mismatch");
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await (process.argv[2] === "--access-only" ? checkAccess() : smokeDeploy());
