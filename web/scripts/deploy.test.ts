import { afterEach, beforeEach, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDeploy } from "./check-deploy.mjs";
import { checkAccess, smokeDeploy } from "./smoke-deploy.mjs";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const manifestBody = (extra: object = {}) =>
  JSON.stringify({
    files: {
      "details.json": sha("details"),
      "full.json": sha("full"),
      "pins.json": sha("pins"),
    },
    inputs: { "assembled-places": "hash" },
    ...extra,
  });

let dist: string;
beforeEach(async () => {
  dist = await mkdtemp(join(tmpdir(), "deploy-check-"));
  await mkdir(join(dist, "data"));
  await writeFile(join(dist, "index.html"), "<!doctype html>");
  for (const name of ["details", "full", "pins"])
    await writeFile(join(dist, "data", name + ".json"), name);
  await writeFile(join(dist, "data/manifest.json"), manifestBody());
});
afterEach(() => rm(dist, { recursive: true, force: true }));

test("accepts a complete real-data build", async () => {
  await expect(checkDeploy(dist)).resolves.toBeUndefined();
});
test("rejects a missing deployment directory", async () => {
  await expect(checkDeploy(join(dist, "missing"))).rejects.toThrow();
});
test.each(["FIXTURE_ONLY.txt", "sw.js"])("rejects %s", async (name) => {
  await writeFile(join(dist, name), "x");
  await expect(checkDeploy(dist)).rejects.toThrow("Forbidden");
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
  await expect(checkDeploy(dist)).rejects.toThrow("Absolute");
});
test("rejects data that differs from the manifest", async () => {
  await writeFile(join(dist, "data/full.json"), "changed");
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
// A deployed site behind Access: only the service token reaches the assets.
const site =
  (overrides: Record<string, number> = {}) =>
  async (url: URL | RequestInfo, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (!hasServiceToken(init)) return login();
    const status =
      overrides[path] ??
      (["/sw.js", "/data/quality.json"].includes(path) ? 404 : 200);
    if (path === "/")
      return new Response("<html>", {
        status,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    return new Response(path === "/data/manifest.json" ? manifestBody() : "x", {
      status,
    });
  };
const env = () => ({
  PUBLIC_ORIGIN: "https://example.test",
  DEPLOY_DIST: dist,
  ACCESS_REQUIRED: "true",
  ...credentials,
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
test("needs a service token while Access is required", async () => {
  await expect(
    smokeDeploy(
      {
        PUBLIC_ORIGIN: "https://example.test",
        DEPLOY_DIST: dist,
        ACCESS_REQUIRED: "true",
      },
      site(),
    ),
  ).rejects.toThrow("service token");
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
