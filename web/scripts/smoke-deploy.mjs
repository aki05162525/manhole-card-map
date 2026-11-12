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
// Without D1 (every preview) the Worker answers 404; either way the response
// must be the Worker's private JSON.
const apiStatuses = { enabled: [200], disabled: [404], undefined: [200, 404] };
async function checkApi(env, origin, headers, request) {
  const expected = apiStatuses[env.API_HEALTH];
  if (!expected) throw new Error("Unknown API_HEALTH: " + env.API_HEALTH);
  const response = await request(new URL("/api/health", origin), {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  const fail = (reason) => {
    throw new Error("/api/health: " + reason);
  };
  if (!expected.includes(response.status)) fail(response.status);
  for (const [name, value] of [
    ["cache-control", "private, no-store"],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "same-origin"],
  ])
    if (response.headers.get(name) !== value) fail(name);
  const body = await response.json().catch(() => fail("not JSON"));
  if (response.status === 200 && body?.ok !== true) fail("unhealthy");
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
  // Loaded here: the workflow's `access` job checks out this file alone.
  const { dataVersion } = await import("./data-version.ts");
  const versioned = `/data-v/${dataVersion(
    await readFile(resolve(env.DEPLOY_DIST || "dist", "data/manifest.json")),
  )}/full.json`;
  for (const [path, status] of [
    ["/", 200],
    // Workers Static Assets serves HTML at the extensionless path.
    ["/cards", 200],
    ["/about", 200],
    ["/account", 200],
    ["/friends", 200],
    ["/__deploy_missing_page__", 404],
    ["/data/manifest.json", 200],
    ["/data/full.json", 200],
    [versioned, 200],
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
      path === "/__deploy_missing_page__" &&
      !Buffer.from(await response.arrayBuffer()).equals(
        await readFile(resolve(env.DEPLOY_DIST || "dist", "404.html")),
      )
    )
      throw new Error("404 page mismatch");
    if (
      path === "/" &&
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error("Expected HTML");
    // SE-1: the site-wide CSP, and no referrer or framing for the screens
    // that share one document (it keeps the headers it opened with).
    // The pages read card data by generation and keep it without revalidation.
    const screen = [
      ["referrer-policy", /^no-referrer$/],
      ["x-frame-options", /^DENY$/],
    ];
    for (const [name, pattern] of {
      "/": [["content-security-policy", /frame-ancestors 'none'/], ...screen],
      "/cards": screen,
      "/friends": screen,
      "/account": screen,
      "/about": screen,
      [versioned]: [["cache-control", /\bimmutable\b/]],
    }[path] ?? [])
      if (!pattern.test(response.headers.get(name) ?? ""))
        throw new Error(path + ": " + name);
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
  await checkApi(env, origin, headers, request);
  for (const path of ["/cards.html", "/about.html"]) {
    const response = await request(new URL(path, origin), {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (
      response.status !== 307 ||
      new URL(response.headers.get("location") || "/", origin).pathname !==
        path.replace(".html", "")
    )
      throw new Error(path + ": expected canonical 307 redirect");
  }
}
// Right after an upload some edge locations still answer with the previous
// version for a short while, so a mismatch is retried before it fails.
export async function retrying(
  check,
  {
    attempts = 4,
    delay = 15000,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await check();
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`Attempt ${attempt} failed (${error.message}); retrying`);
      await sleep(delay);
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await retrying(() =>
    process.argv[2] === "--access-only" ? checkAccess() : smokeDeploy(),
  );
