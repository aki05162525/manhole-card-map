import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestHarness, experimental_readRawConfig } from "wrangler";
import type { D1Database, D1PreparedStatement } from "./env";

const web = fileURLToPath(new URL("..", import.meta.url));

export const pages = {
  "index.html": "<!doctype html><title>map</title>",
  "cards.html": "<!doctype html><title>cards</title>",
  "404.html": "<!doctype html><title>missing</title>",
  // Shows whether `_headers` still applies to pages the script passes on.
  _headers: "/*\n  X-Content-Type-Options: nosniff\n",
};

type Options = {
  // Load the D1 bindings and local vars of `env.dev` instead of production's.
  dev?: boolean;
  main?: string;
  secrets?: Record<string, string>;
};

// Runs the deployed Wrangler config in workerd, with stand-in assets so the
// tests do not depend on a prior build.
export async function startWorker({
  dev = false,
  main,
  secrets,
}: Options = {}) {
  const assets = await mkdtemp(join(tmpdir(), "worker-assets-"));
  await mkdir(assets, { recursive: true });
  for (const [name, body] of Object.entries(pages))
    await writeFile(join(assets, name), body);
  const { rawConfig } = experimental_readRawConfig({
    config: join(web, "wrangler.jsonc"),
  });
  const { env, ...production } = rawConfig;
  const local = dev ? env?.dev : undefined;
  if (dev && !local) throw new Error("wrangler.jsonc has no env.dev");
  const config = {
    ...production,
    main: resolve(web, main ?? production.main ?? ""),
    assets: { ...production.assets, directory: assets },
    // Inline configs take no secrets; at runtime both are plain env strings.
    vars: { ...(local?.vars ?? production.vars), ...secrets },
    // Keep the chosen environment's bindings so a production D1 shows up here.
    d1_databases: (local ?? production).d1_databases?.map(
      (database: { binding: string; migrations_dir?: string }) => ({
        ...database,
        migrations_dir: resolve(web, database.migrations_dir ?? "migrations"),
      }),
    ),
  };
  const harness = createTestHarness({
    root: web,
    workers: [{ config }],
  });
  await harness.listen();
  const worker = harness.getWorker();
  for (const database of config.d1_databases ?? [])
    await worker.applyD1Migrations(database.binding);
  return {
    harness,
    worker,
    async close() {
      await harness.close();
      await rm(assets, { recursive: true, force: true });
    },
  };
}

// Wraps a D1 binding and counts its round trips: each first, all, run and
// batch is one.
export function countCalls(db: D1Database) {
  const unwrapped = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const counter = { calls: 0, db: undefined as unknown as D1Database };
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped: D1PreparedStatement = {
      bind: (...values) => wrap(statement.bind(...values)),
      first: <T>() => (counter.calls++, statement.first<T>()),
      all: <T>() => (counter.calls++, statement.all<T>()),
      run: () => (counter.calls++, statement.run()),
    };
    unwrapped.set(wrapped, statement);
    return wrapped;
  };
  counter.db = {
    prepare: (query) => wrap(db.prepare(query)),
    batch: (statements) => (
      counter.calls++,
      db.batch(statements.map((statement) => unwrapped.get(statement)!))
    ),
  };
  return counter;
}
