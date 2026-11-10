import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  apiHealth,
  d1Bindings,
  previewConfig,
  readConfig,
  writePreviewConfig,
} from "./wrangler-config.mjs";

const database = (binding: string) => ({
  binding,
  database_name: binding.toLowerCase(),
  database_id: "id-" + binding,
});
const withD1 = {
  name: "manhole-card-map",
  main: "worker/index.ts",
  assets: { directory: "./dist", run_worker_first: ["/api/*"] },
  vars: { ALLOWED_ORIGIN: "https://manhole-techo.com" },
  d1_databases: [database("DB"), database("TOMBSTONES")],
  env: { dev: { d1_databases: [database("DB")] } },
};

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "wrangler-config-"));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

test("drops every D1 binding and environment from the preview", () => {
  expect(previewConfig(withD1)).toEqual({
    name: "manhole-card-map",
    main: "worker/index.ts",
    assets: { directory: "./dist", run_worker_first: ["/api/*"] },
    vars: { ALLOWED_ORIGIN: "https://manhole-techo.com" },
  });
  expect(withD1.d1_databases).toHaveLength(2);
});
test("refuses a preview with a D1 binding it does not know how to drop", () => {
  expect(() =>
    previewConfig({ ...withD1, unknown: { d1_databases: [database("DB")] } }),
  ).toThrow("D1");
});
test("keeps the production settings in the preview of the real config", async () => {
  const production = readConfig("wrangler.jsonc");
  const out = join(directory, "wrangler.preview.json");
  await writePreviewConfig("wrangler.jsonc", out);
  const preview = JSON.parse(await readFile(out, "utf8"));
  const { env: _env, d1_databases: _d1, ...shared } = production;
  expect(preview).toEqual(shared);
  expect(JSON.stringify(preview)).not.toContain("d1_databases");
});
test("lists the production D1 bindings to migrate", () => {
  expect(d1Bindings(withD1)).toEqual(["DB", "TOMBSTONES"]);
  expect(d1Bindings(previewConfig(withD1))).toEqual([]);
  // env.dev never reaches production.
  expect(d1Bindings(readConfig("wrangler.jsonc"))).toEqual([]);
});
test("expects a healthy API only with the main database", () => {
  expect(apiHealth(withD1)).toBe("enabled");
  expect(apiHealth(previewConfig(withD1))).toBe("disabled");
  expect(apiHealth({ d1_databases: [database("TOMBSTONES")] })).toBe(
    "disabled",
  );
});
