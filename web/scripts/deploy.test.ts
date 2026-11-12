import { afterEach, beforeEach, expect, test } from "vitest";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { join } from "node:path";
import {
  checkAuthBoundary,
  checkCatalogDependencies,
  checkDeploy,
} from "./check-deploy.mjs";
import { dataVersion } from "./data-version.ts";
import {
  embedCatalogSummary,
  summarizeCatalog,
} from "../src/domain/catalog-summary.ts";
import { fixtureData } from "./fixtures.ts";
import { checkAccess, retrying, smokeDeploy } from "./smoke-deploy.mjs";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const full = JSON.stringify(fixtureData);
const content = (name: string) => (name === "full" ? full : "{}");
const manifestBody = (extra: object = {}) =>
  JSON.stringify({
    files: {
      "details.json": sha("{}"),
      "full.json": sha(full),
      "pins.json": sha("{}"),
    },
    ...extra,
  });
// The map and the catalog start the pages' own fetches with the HTML.
const generation = () => `/data-v/${dataVersion(manifestBody())}`;
const preload = (href = `${generation()}/full.json`, low = false) =>
  `<link rel="preload" as="fetch" href="${href}" crossorigin${low ? ' fetchpriority="low"' : ""}>`;
const mapPage = (path = generation(), lowDetails = true) =>
  `<!doctype html>${preload(`${path}/pins.json`)}${preload(`${path}/details.json`, lowDetails)}`;
const cardsPage = (source = fixtureData, href?: string) =>
  `<!doctype html>${preload(href)}<div id="root" ${embedCatalogSummary(
    "data-catalog-summary",
    summarizeCatalog(source),
  )}></div>`;

let dist: string;
// Where the pages read the data of this manifest.
const versioned = (manifest = manifestBody()) =>
  join(dist, "data-v", dataVersion(manifest));
beforeEach(async () => {
  dist = await mkdtemp(join(tmpdir(), "deploy-check-"));
  await mkdir(join(dist, "data"));
  await writeFile(join(dist, "index.html"), mapPage());
  await writeFile(join(dist, "about.html"), "<!doctype html>");
  await writeFile(join(dist, "404.html"), "<!doctype html>");
  await writeFile(join(dist, "cards.html"), cardsPage());
  await writeFile(join(dist, "account.html"), "<!doctype html>");
  await writeFile(join(dist, "terms.html"), "<!doctype html>");
  await writeFile(join(dist, "friends.html"), "<!doctype html>");
  await mkdir(join(dist, "friends"));
  await writeFile(join(dist, "friends/invite.html"), "<!doctype html>");
  for (const name of ["details", "full", "pins"])
    await writeFile(join(dist, "data", name + ".json"), content(name));
  await writeFile(join(dist, "data/manifest.json"), manifestBody());
  await mkdir(versioned(), { recursive: true });
  for (const name of ["details", "full", "pins"])
    await writeFile(join(versioned(), name + ".json"), content(name));
});
afterEach(() => rm(dist, { recursive: true, force: true }));

test("accepts a complete real-data build", async () => {
  await expect(checkDeploy(dist)).resolves.toBeUndefined();
});
test("rejects a catalog first view counted from other data", async () => {
  await writeFile(
    join(dist, "cards.html"),
    cardsPage({ ...fixtureData, cards: fixtureData.cards.slice(1) }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("cards.html: summary");
});
test.each(["index.html", "cards.html"])(
  "rejects %s preloading data other than the generation the pages read",
  async (page) => {
    await writeFile(
      join(dist, page),
      page === "cards.html"
        ? cardsPage(fixtureData, "/data/full.json")
        : mapPage("/data"),
    );
    await expect(checkDeploy(dist)).rejects.toThrow(`${page}: preload`);
  },
);
test.each([
  ["the full data", `<!doctype html>${preload()}`],
  ["the details ahead of the pins", mapPage(undefined, false)],
])("rejects a map preloading %s", async (_name, html) => {
  await writeFile(join(dist, "index.html"), html);
  await expect(checkDeploy(dist)).rejects.toThrow("index.html: preload");
});
test("rejects a missing deployment directory", async () => {
  await expect(checkDeploy(join(dist, "missing"))).rejects.toThrow();
});
test.each(["FIXTURE_ONLY.txt", "sw.js"])("rejects %s", async (name) => {
  await writeFile(join(dist, name), "x");
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden");
});
test("rejects review notes in public data", async () => {
  await writeFile(
    join(dist, "data/manifest.json"),
    manifestBody({ override: { reviewer: "x" } }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden key");
});
test("rejects a fixture manifest", async () => {
  await writeFile(
    join(dist, "data/manifest.json"),
    manifestBody({ fixture: true }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Fixture");
});
test("rejects local paths in manifest inputs", async () => {
  await writeFile(
    join(dist, "data/manifest.json"),
    manifestBody({ inputs: { "/tmp/ledger.json": "hash" } }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden key");
});
test("rejects data that differs from the manifest", async () => {
  await writeFile(join(dist, "data/full.json"), "changed");
  await expect(checkDeploy(dist)).rejects.toThrow("Hash mismatch");
});
test("rejects a build without the copy the pages read", async () => {
  await rm(join(versioned(), "full.json"));
  await expect(checkDeploy(dist)).rejects.toThrow();
});
test("rejects a copy that differs from the manifest", async () => {
  await writeFile(join(versioned(), "pins.json"), "changed");
  await expect(checkDeploy(dist)).rejects.toThrow("Hash mismatch");
});
test("rejects a missing required file", async () => {
  await rm(join(dist, "data/pins.json"));
  await expect(checkDeploy(dist)).rejects.toThrow();
});
test("rejects files over the asset size limit", async () => {
  await writeFile(join(dist, "large.bin"), "");
  await truncate(join(dist, "large.bin"), 25 * 1024 * 1024 + 1);
  await expect(checkDeploy(dist)).rejects.toThrow("Oversized");
});

test.each([
  "snapshotPath",
  "snapshotSHA256",
  "sourceLocator",
  "verificationMethod",
  "actorType",
  "inputs",
  "reviewSource",
  "reviewSourceHash",
])("rejects nested internal key %s", async (key) => {
  await writeFile(
    join(dist, "extra.json"),
    JSON.stringify({ nested: [{ [key]: "private" }] }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden key");
});
test.each([
  "/tmp/",
  "/home/",
  "data/work/",
  "data/raw/",
  "data/evidence/",
  "docs/verification/",
])("rejects local value %s", async (path) => {
  await writeFile(
    join(dist, "extra.json"),
    JSON.stringify({ text: `根拠は ${path}file` }),
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Local path");
});
test.each(["source", "reason", "review", "futureField"])(
  "rejects coordinate field %s",
  async (key) => {
    await writeFile(
      join(dist, "extra.json"),
      JSON.stringify({
        places: [
          {
            coordinate: {
              status: "confirmed",
              lat: 35,
              lng: 139,
              [key]: "private",
            },
          },
        ],
      }),
    );
    await expect(checkDeploy(dist)).rejects.toThrow("Coordinate key");
  },
);
test("rejects an internal quality report even when assetsignore excludes it", async () => {
  await writeFile(join(dist, "data/quality.json"), "{}");
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden");
});

const hasServiceToken = (init?: RequestInit) =>
  new Headers(init?.headers).has("CF-Access-Client-Id");
const credentials = {
  CF_ACCESS_CLIENT_ID: "id",
  CF_ACCESS_CLIENT_SECRET: "secret",
};
const login = () =>
  new Response(null, {
    status: 302,
    headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access" },
  });
const apiHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};
const siteCsp = "default-src 'self'; frame-ancestors 'none'";
// The screens of one document carry the same protection (SE-1).
const screenHeaders = {
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};
// A deployed site behind Access: only the service token reaches the assets.
const site =
  (overrides: Record<string, number> = {}) =>
  async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (!hasServiceToken(init)) return login();
    const status =
      overrides[path] ??
      (["/sw.js", "/data/quality.json", "/__deploy_missing_page__"].includes(
        path,
      )
        ? 404
        : path.endsWith(".html")
          ? 307
          : 200);
    if (path.endsWith(".html"))
      return new Response(null, {
        status,
        headers: { location: path.replace(".html", "") },
      });
    if (path === "/__deploy_missing_page__")
      return new Response("<!doctype html>", { status });
    // Production has no D1 yet, so the Worker disables the API.
    if (path === "/api/health")
      return Response.json(
        status === 200 ? { ok: true } : { error: "not_found" },
        { status: overrides[path] ?? 404, headers: apiHeaders },
      );
    if (path === "/")
      return new Response("<html>", {
        status,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": siteCsp,
          ...screenHeaders,
        },
      });
    if (["/cards", "/friends", "/account"].includes(path))
      return new Response("<html>", { status, headers: screenHeaders });
    return new Response(path === "/data/manifest.json" ? manifestBody() : "x", {
      status,
      headers: path.startsWith("/data-v/")
        ? { "cache-control": "public, max-age=31536000, immutable" }
        : {},
    });
  };
const env = () => ({
  PUBLIC_ORIGIN: "https://example.test",
  DEPLOY_DIST: dist,
  ACCESS_REQUIRED: "true",
  ...credentials,
});

// The deploy workflow's `access` job checks out this one file.
test("the smoke script loads without its neighbours", async () => {
  const alone = join(dist, "smoke-deploy.mjs");
  await copyFile("scripts/smoke-deploy.mjs", alone);
  await expect(
    promisify(execFile)(process.execPath, [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(alone)})`,
    ]),
  ).resolves.toBeDefined();
});
test("requires a public origin", async () => {
  await expect(smokeDeploy({})).rejects.toThrow("PUBLIC_ORIGIN");
  await expect(checkAccess({})).rejects.toThrow("PUBLIC_ORIGIN");
});
test("passes a matching deployment behind Access", async () => {
  await expect(smokeDeploy(env(), site())).resolves.toBeUndefined();
});
test.each(["/sw.js", "/data/quality.json"])(
  "fails when %s is served",
  async (path) => {
    await expect(smokeDeploy(env(), site({ [path]: 200 }))).rejects.toThrow(
      path,
    );
  },
);
test("fails when the served manifest differs", async () => {
  await writeFile(
    join(dist, "data/manifest.json"),
    manifestBody({ updated: "other" }),
  );
  await expect(smokeDeploy(env(), site())).rejects.toThrow("Manifest mismatch");
});
test("fails on partial Access credentials", async () => {
  await expect(
    smokeDeploy(
      { PUBLIC_ORIGIN: "https://example.test", CF_ACCESS_CLIENT_ID: "id" },
      site(),
    ),
  ).rejects.toThrow("Incomplete");
});
test("checks only the Access block without a service token", async () => {
  const requested: string[] = [];
  const blocked = async (url: URL | RequestInfo) => {
    requested.push(new URL(String(url)).pathname);
    return login();
  };
  await expect(
    smokeDeploy(
      {
        PUBLIC_ORIGIN: "https://example.test",
        DEPLOY_DIST: dist,
        ACCESS_REQUIRED: "true",
      },
      blocked,
    ),
  ).resolves.toBeUndefined();
  expect(requested).toEqual(["/"]);
});
test("fails without a service token when the site became public", async () => {
  await expect(
    smokeDeploy(
      {
        PUBLIC_ORIGIN: "https://example.test",
        DEPLOY_DIST: dist,
        ACCESS_REQUIRED: "true",
      },
      async () => new Response("<html>", { status: 200 }),
    ),
  ).rejects.toThrow("Access");
});

test.each([
  ["a login redirect", login],
  ["a 403 response", () => new Response("", { status: 403 })],
])("treats %s as protected", async (_, respond) => {
  await expect(
    checkAccess({ PUBLIC_ORIGIN: "https://example.test" }, async () =>
      respond(),
    ),
  ).resolves.toBeUndefined();
});
test.each([
  ["a public page", () => new Response("<html>", { status: 200 })],
  ["an empty Worker", () => new Response("", { status: 404 })],
  [
    "a redirect to another site",
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://cloudflareaccess.com.example.test/" },
      }),
  ],
])("refuses to publish when the origin returns %s", async (_, respond) => {
  await expect(
    checkAccess({ PUBLIC_ORIGIN: "https://example.test" }, async () =>
      respond(),
    ),
  ).rejects.toThrow("Access");
});
test("fails a deployment that became reachable without Access", async () => {
  const exposed = async (url: URL | RequestInfo, init?: RequestInit) =>
    hasServiceToken(init)
      ? site()(url, init)
      : new Response("<html>", { status: 200 });
  await expect(smokeDeploy(env(), exposed)).rejects.toThrow("Access");
});
test("skips the Access check after public release", async () => {
  const open = async (url: URL | RequestInfo, init?: RequestInit) =>
    site()(url, { ...init, headers: { "CF-Access-Client-Id": "public" } });
  await expect(
    smokeDeploy(
      {
        PUBLIC_ORIGIN: "https://example.test",
        DEPLOY_DIST: dist,
        ACCESS_REQUIRED: "false",
      },
      open,
    ),
  ).resolves.toBeUndefined();
});

test("rejects a missing about page", async () => {
  await rm(join(dist, "about.html"));
  await expect(checkDeploy(dist)).rejects.toThrow("about.html");
});

test("publishes for search engines only through the custom domain", async () => {
  const headers = await readFile("deploy/_headers", "utf8");
  expect(headers).not.toContain("X-Robots-Tag");
  expect(headers).toContain("X-Content-Type-Options: nosniff");
  const wrangler = await readFile("wrangler.jsonc", "utf8");
  expect(wrangler).toContain('"workers_dev": false');
  expect(wrangler).toContain('"preview_urls": true');
});

test("previews each pull request without touching production", async () => {
  const workflow = await readFile("../.github/workflows/preview.yml", "utf8");
  expect(workflow).toContain("pull_request:");
  expect(workflow).toContain("wrangler versions upload --preview-alias");
  expect(workflow).not.toContain("wrangler deploy");
  // Previews must not compete with the public site in search results.
  expect(workflow).toContain("X-Robots-Tag: noindex");
  // The CARTO key only allows the production hosts.
  expect(workflow).not.toContain("VITE_MAP_STYLE_URL");
  expect(workflow).toContain("pull-requests: write");
  expect(workflow).toContain(
    "github.event.pull_request.head.repo.full_name == github.repository",
  );
  // PR code must never run against the production D1 (TE-1).
  const generate = workflow.indexOf(
    "node scripts/wrangler-config.mjs preview wrangler.preview.json",
  );
  const upload = workflow.indexOf(
    'wrangler versions upload --preview-alias "$ALIAS" --config wrangler.preview.json',
  );
  expect(generate).toBeGreaterThan(0);
  expect(upload).toBeGreaterThan(generate);
  expect(workflow).toContain("API_HEALTH: disabled");
});

test("migrates D1 before the production Worker and checks its API", async () => {
  const workflow = await readFile("../.github/workflows/deploy.yml", "utf8");
  const migrate = workflow.indexOf("wrangler d1 migrations apply");
  const deploy = workflow.indexOf("wrangler deploy --message");
  expect(migrate).toBeGreaterThan(0);
  expect(deploy).toBeGreaterThan(migrate);
  expect(workflow).toContain("node scripts/wrangler-config.mjs d1");
  expect(workflow).toContain("node scripts/wrangler-config.mjs api-health");
});

test("rejects a missing cards page", async () => {
  await rm(join(dist, "cards.html"));
  await expect(checkDeploy(dist)).rejects.toThrow("cards.html");
});
test("rejects map code in catalog dependencies transitively", async () => {
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "cards.html"),
    '<script type="module" blocking="render" src="/assets/cards.js"></script>',
  );
  await writeFile(join(dist, "assets/cards.js"), 'import "./shared.js";');
  await writeFile(join(dist, "assets/shared.js"), 'import("./map.js");');
  await writeFile(
    join(dist, "assets/map.js"),
    'const worker = "maplibre-gl-worker.mjs";',
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Catalog map dependency");
});

test("requires the deployed cards page", async () => {
  await expect(smokeDeploy(env(), site({ "/cards": 404 }))).rejects.toThrow(
    "/cards",
  );
});

// Fixture builds are never publishable, but their catalog dependency graph must
// satisfy the same boundary as a production build.
test("checks catalog dependencies independently of the fixture marker", async () => {
  await writeFile(join(dist, "FIXTURE_ONLY.txt"), "fixture");
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "cards.html"),
    '<script src="/assets/cards.js"></script>',
  );
  await writeFile(join(dist, "assets/cards.js"), 'import "./shared.js";');
  await writeFile(
    join(dist, "assets/shared.js"),
    'export const label = "cards";',
  );
  await expect(checkCatalogDependencies(dist)).resolves.toBeUndefined();
  await writeFile(join(dist, "assets/shared.js"), 'import "./maplibre-gl.js";');
  await expect(checkCatalogDependencies(dist)).rejects.toThrow(
    "Catalog map dependency",
  );
  await expect(checkDeploy(dist)).rejects.toThrow(
    "Forbidden: FIXTURE_ONLY.txt",
  );
});

// As Vite writes a dynamic import: the chunk, with what it brings preloaded,
// at the module's top level or (`inside`) in a function called later.
const preloaded = (
  deps: string[],
  calls: [string, number[]][],
  inside = false,
) =>
  `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=${JSON.stringify(deps)})))=>i.map(i=>d[i]);` +
  calls
    .map(([chunk, indices]) => {
      const call = `l(()=>import(\`./${chunk}\`),__vite__mapDeps([${indices}]))`;
      return inside
        ? `var load${indices[0]}=async e=>(await ${call}).default;`
        : `${call};`;
    })
    .join("");
async function catalogFirstView(entry: string) {
  await mkdir(join(dist, "assets"), { recursive: true });
  await writeFile(
    join(dist, "cards.html"),
    '<script blocking="render" type="module" src="/assets/cards.js"></script>',
  );
  await writeFile(join(dist, "assets/cards.js"), entry);
  await writeFile(
    join(dist, "assets/map-screen-abc.js"),
    'import "./card-map-abc.js";export default "map-stage";',
  );
  await writeFile(join(dist, "assets/card-map-abc.js"), "maplibre");
  await writeFile(join(dist, "assets/map-screen-abc.css"), ".map-stage{}");
  await writeFile(join(dist, "assets/records-abc.js"), "export {};");
  await writeFile(join(dist, "assets/records-abc.css"), ".record{}");
}
// The catalog's first view fetches no map code; the map comes on a switch.
test("lets the catalog import the map only for the switch to it", async () => {
  await catalogFirstView(
    preloaded(
      [
        "assets/map-screen-abc.js",
        "assets/map-screen-abc.css",
        "assets/records-abc.js",
        "assets/records-abc.css",
      ],
      [
        ["map-screen-abc.js", [0, 1]],
        ["records-abc.js", [2, 3]],
      ],
      true,
    ),
  );
  await expect(checkCatalogDependencies(dist)).resolves.toBeUndefined();
});
test.each([
  [
    "a dynamic import of the map's own code",
    preloaded(["assets/card-map-abc.js"], [["card-map-abc.js", [0]]]),
  ],
  [
    "the map's stylesheet preloaded by another import",
    preloaded(
      ["assets/records-abc.js", "assets/map-screen-abc.css"],
      [["records-abc.js", [0, 1]]],
    ),
  ],
  ["a static import of the switch", 'import "./map-screen-abc.js";'],
  // Called as the module runs, the switch's import loads the map at once.
  [
    "the switch's import at the top level",
    preloaded(
      ["assets/map-screen-abc.js", "assets/map-screen-abc.css"],
      [["map-screen-abc.js", [0, 1]]],
    ),
  ],
  [
    "a dynamic import in a backquoted chunk",
    "l(()=>import(`./card-map-abc.js`));",
  ],
])("rejects %s in the catalog's first view", async (_name, entry) => {
  await catalogFirstView(entry);
  await expect(checkCatalogDependencies(dist)).rejects.toThrow(
    "Catalog map dependency",
  );
});
test("rejects the switch to the map from pages that are not the catalog", async () => {
  await catalogFirstView("export {};");
  await writeFile(
    join(dist, "about.html"),
    '<script blocking="render" type="module" src="/assets/about.js"></script>',
  );
  await writeFile(
    join(dist, "assets/about.js"),
    preloaded(["assets/map-screen-abc.js"], [["map-screen-abc.js", [0]]]),
  );
  await expect(checkCatalogDependencies(dist)).rejects.toThrow(
    "Catalog map dependency",
  );
});
test.each(["about.html", "404.html", "friends.html", "friends/invite.html"])(
  "rejects map code in %s",
  async (page) => {
    await writeFile(join(dist, page), '<script src="/map.js"></script>');
    await writeFile(join(dist, "map.js"), 'const engine = "maplibre";');
    await expect(checkCatalogDependencies(dist)).rejects.toThrow(
      "Catalog map dependency",
    );
  },
);
test("requires the custom 404 build", async () => {
  await rm(join(dist, "404.html"), { force: true });
  await expect(checkDeploy(dist)).rejects.toThrow("404.html");
});

test("requires the custom missing-URL response and canonical redirects", async () => {
  await expect(
    smokeDeploy(env(), site({ "/__deploy_missing_page__": 200 })),
  ).rejects.toThrow("/__deploy_missing_page__");
  await expect(
    smokeDeploy(env(), site({ "/about.html": 200 })),
  ).rejects.toThrow("/about.html");
});
test("rejects a generic 404 instead of the built page", async () => {
  const generic = async (url: URL | RequestInfo, init?: RequestInit) => {
    if (new URL(String(url)).pathname === "/__deploy_missing_page__")
      return new Response("Not found", { status: 404 });
    return site()(url, init);
  };
  await expect(smokeDeploy(env(), generic)).rejects.toThrow(
    "404 page mismatch",
  );
});

test("rejects a document module that lost render blocking during build", async () => {
  await writeFile(
    join(dist, "about.html"),
    '<script type="module" src="/about.js"></script>',
  );
  await writeFile(join(dist, "about.js"), 'export const title = "about";');
  await expect(checkCatalogDependencies(dist)).rejects.toThrow(
    "Document render block",
  );
});

test.each([
  ["a SQL migration", "migrations/0001.sql", "CREATE TABLE users (id TEXT);"],
  ["the session cookie", "assets/a.js", 'document.cookie="__Host-session=x"'],
  ["an account query", "assets/b.js", 'q("SELECT * FROM sessions WHERE x")'],
  ["a write to records", "page.html", "<p>INSERT INTO records</p>"],
])("rejects Worker code in assets: %s", async (_, name, body) => {
  await mkdir(join(dist, name, ".."), { recursive: true });
  await writeFile(join(dist, name), body);
  await expect(checkDeploy(dist)).rejects.toThrow("Worker code");
});
test("accepts words that only resemble the Worker", async () => {
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "assets/c.js"),
    'const text = "records from sessions"; const s = "signed_in";',
  );
  await expect(checkDeploy(dist)).resolves.toBeUndefined();
});

test("accepts the disabled API of a deployment without D1", async () => {
  for (const API_HEALTH of [undefined, "disabled"])
    await expect(
      smokeDeploy({ ...env(), API_HEALTH }, site()),
    ).resolves.toBeUndefined();
});
test("requires a healthy API once D1 is configured", async () => {
  await expect(
    smokeDeploy({ ...env(), API_HEALTH: "enabled" }, site()),
  ).rejects.toThrow("/api/health: 404");
  await expect(
    smokeDeploy(
      { ...env(), API_HEALTH: "enabled" },
      site({ "/api/health": 200 }),
    ),
  ).resolves.toBeUndefined();
});
test("fails when a preview API reaches a database", async () => {
  await expect(
    smokeDeploy(
      { ...env(), API_HEALTH: "disabled" },
      site({ "/api/health": 200 }),
    ),
  ).rejects.toThrow("/api/health: 200");
});
test("rejects an unknown API expectation", async () => {
  await expect(
    smokeDeploy({ ...env(), API_HEALTH: "maybe" }, site()),
  ).rejects.toThrow("API_HEALTH");
});
test.each([
  ["cache-control", "public, max-age=60"],
  ["x-content-type-options", ""],
  ["referrer-policy", ""],
])("fails when the API sends %s %j", async (name, value) => {
  const leaky = async (url: URL | RequestInfo, init?: RequestInit) => {
    const response = await site()(url, init);
    if (new URL(String(url)).pathname !== "/api/health") return response;
    const headers = new Headers(response.headers);
    if (value) headers.set(name, value);
    else headers.delete(name);
    return new Response(response.body, { status: 404, headers });
  };
  await expect(smokeDeploy(env(), leaky)).rejects.toThrow("/api/health");
});
test("fails when /api/* is served by the 404 page instead of the Worker", async () => {
  const assetsOnly = async (url: URL | RequestInfo, init?: RequestInit) =>
    new URL(String(url)).pathname === "/api/health"
      ? new Response("<!doctype html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        })
      : site()(url, init);
  await expect(smokeDeploy(env(), assetsOnly)).rejects.toThrow("/api/health");
});

test.each([
  "account.html",
  "terms.html",
  "friends.html",
  "friends/invite.html",
])("requires the %s page", async (page) => {
  await rm(join(dist, page));
  await expect(checkDeploy(dist)).rejects.toThrow(page);
});

// PF-1: passkey code loads on its own page, or with the switch to it.
test("rejects passkey code statically imported by a browsing page", async () => {
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "index.html"),
    '<script type="module" src="/assets/main.js"></script>',
  );
  await writeFile(
    join(dist, "assets/main.js"),
    'import{a as b}from"./shared.js";' +
      preloaded(
        ["assets/account-screen-abc.js"],
        [["account-screen-abc.js", [0]]],
        true,
      ),
  );
  await writeFile(join(dist, "assets/shared.js"), "export const a = 1;");
  await writeFile(
    join(dist, "assets/account-screen-abc.js"),
    "navigator.credentials.get({})",
  );
  await expect(checkAuthBoundary(dist)).resolves.toBeUndefined();
  await writeFile(
    join(dist, "assets/shared.js"),
    'fetch("/api/auth/login/options")',
  );
  await expect(checkAuthBoundary(dist)).rejects.toThrow(
    "Passkey code in index.html",
  );
  await expect(checkDeploy(dist)).rejects.toThrow("Passkey code");
});

// The account screen comes with a switch to it, in a function the switch
// calls; at a module's top level it would load with the page.
test.each(["index.html", "cards.html", "friends.html"])(
  "rejects the account screen at the top level of %s",
  async (page) => {
    await mkdir(join(dist, "assets"));
    await writeFile(
      join(dist, page),
      '<script type="module" blocking="render" src="/assets/entry.js"></script>',
    );
    await writeFile(
      join(dist, "assets/account-screen-abc.js"),
      "navigator.credentials.get({})",
    );
    const entry = (inside: boolean) =>
      preloaded(
        ["assets/account-screen-abc.js"],
        [["account-screen-abc.js", [0]]],
        inside,
      );
    await writeFile(join(dist, "assets/entry.js"), entry(true));
    await expect(checkAuthBoundary(dist)).resolves.toBeUndefined();
    await writeFile(join(dist, "assets/entry.js"), entry(false));
    await expect(checkAuthBoundary(dist)).rejects.toThrow(
      `Passkey code in ${page}`,
    );
  },
);
test("rejects the account screen loaded from a page that does not switch", async () => {
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "about.html"),
    '<script type="module" blocking="render" src="/assets/about.js"></script>',
  );
  await writeFile(
    join(dist, "assets/about.js"),
    preloaded(
      ["assets/account-screen-abc.js"],
      [["account-screen-abc.js", [0]]],
      true,
    ),
  );
  // A build without accounts has no passkey code in it; the name still counts.
  await writeFile(join(dist, "assets/account-screen-abc.js"), "export {};");
  await expect(checkAuthBoundary(dist)).rejects.toThrow(
    "Passkey code in about.html",
  );
});

test("allows passkey code on the account page", async () => {
  await mkdir(join(dist, "assets"));
  await writeFile(
    join(dist, "account.html"),
    '<script type="module" blocking="render" src="/assets/account.js"></script>',
  );
  await writeFile(
    join(dist, "assets/account.js"),
    "navigator.credentials.create({})",
  );
  await expect(checkDeploy(dist)).resolves.toBeUndefined();
});

// SE-1: the site-wide CSP and the screens' own headers.
test.each([
  ["/", "content-security-policy"],
  ...["/", "/cards", "/friends", "/account"].flatMap((path) => [
    [path, "referrer-policy"],
    [path, "x-frame-options"],
  ]),
  ["versioned data", "cache-control"],
])("fails when %s lacks %s", async (name, header) => {
  const target =
    name === "versioned data"
      ? `/data-v/${dataVersion(manifestBody())}/full.json`
      : name;
  const stripped = async (url: URL | RequestInfo, init?: RequestInit) => {
    const response = await site()(url, init);
    if (new URL(String(url)).pathname !== target) return response;
    const headers = new Headers(response.headers);
    headers.delete(header);
    return new Response(response.body, { status: response.status, headers });
  };
  await expect(smokeDeploy(env(), stripped)).rejects.toThrow(
    target + ": " + header,
  );
});

test("ships the CSP and account headers", async () => {
  const headers = await readFile("deploy/_headers", "utf8");
  const policy = headers.match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1];
  for (const directive of [
    "default-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "connect-src 'self' https://basemaps.cartocdn.com https://tiles.basemaps.cartocdn.com https://cloudflareinsights.com",
    "worker-src 'self' blob:",
  ])
    expect(policy).toContain(directive);
  expect(policy).not.toContain("unsafe");
  for (const path of [
    "/",
    "/index.html",
    "/cards",
    "/cards.html",
    "/friends",
    "/friends.html",
    "/account",
    "/account.html",
  ])
    expect(headers).toContain(
      `\n${path}\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n`,
    );
});

test.each(["friends.html", "friends/invite.html"])(
  "keeps passkeys out of %s",
  async (page) => {
    await writeFile(
      join(dist, page),
      '<script type="module" blocking="render" src="/bad.js"></script>',
    );
    await writeFile(join(dist, "bad.js"), "navigator.credentials.get({})");
    await expect(checkAuthBoundary(dist)).rejects.toThrow(
      `Passkey code in ${page}`,
    );
  },
);

test.each(["friends.html", "friends/invite.html"])(
  "marks %s private and keeps source compatible with CSP",
  async (page) => {
    const html = await readFile(page, "utf8");
    expect(html).toMatch(/name="robots" content="noindex"/);
    expect(html).not.toMatch(/\sstyle=|<script[^>]*>[^<]+<\/script>/);
    const headers = await readFile("deploy/_headers", "utf8");
    expect(headers).toContain(
      `/${page.replace(".html", "")}\n  Referrer-Policy: no-referrer`,
    );
  },
);

test("retries a post-deploy check while the edge still serves the old version", async () => {
  const waits: number[] = [];
  let calls = 0;
  const check = async () => {
    calls++;
    if (calls < 3) throw new Error("404 page mismatch");
  };
  await retrying(check, {
    attempts: 4,
    delay: 15000,
    sleep: async (ms) => void waits.push(ms),
  });
  expect(calls).toBe(3);
  expect(waits).toEqual([15000, 15000]);
});

test("reports the last failure after the retries run out", async () => {
  let calls = 0;
  const check = async () => {
    calls++;
    throw new Error("Manifest mismatch " + calls);
  };
  await expect(
    retrying(check, { attempts: 3, delay: 1, sleep: async () => {} }),
  ).rejects.toThrow("Manifest mismatch 3");
  expect(calls).toBe(3);
});
