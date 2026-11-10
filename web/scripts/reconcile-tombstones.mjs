import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Settles tombstones left 'pending' by a deletion that failed half way
// (PR-6). Run before replaying tombstones after a Time Travel restore, with
// the main database as it is before the restore: a subject that is gone was
// deleted, so the record becomes 'done'; one that still exists was not, so
// the record goes. Kinds this script cannot check stay pending.
const subjects = {
  account: ["users", "id"],
  credential: ["credentials", "id"],
};
// wrangler d1 execute takes no parameters; IDs are base64url only.
const safeId = /^[A-Za-z0-9_-]{1,200}$/;

export async function reconcile({ main, tombstones }) {
  const counts = { done: 0, removed: 0, unknown: 0 };
  const pending = await tombstones.all(
    "SELECT id, kind, subject FROM tombstones WHERE state = 'pending' ORDER BY id",
  );
  for (const { id, kind, subject } of pending) {
    const target = subjects[kind];
    if (!target || !safeId.test(String(subject)) || !Number.isInteger(id)) {
      counts.unknown++;
      continue;
    }
    const [table, column] = target;
    const found = await main.all(
      `SELECT 1 AS found FROM ${table} WHERE ${column} = '${subject}'`,
    );
    if (found.length) {
      await tombstones.all(
        `DELETE FROM tombstones WHERE id = ${id} AND state = 'pending'`,
      );
      counts.removed++;
    } else {
      await tombstones.all(
        `UPDATE tombstones SET state = 'done' WHERE id = ${id} AND state = 'pending'`,
      );
      counts.done++;
    }
  }
  return counts;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const flags = process.argv.slice(2);
  if (!flags.includes("--remote") && !flags.includes("--local"))
    throw new Error(
      "Usage: reconcile-tombstones.mjs --remote | --local [--env dev]",
    );
  const wrangler = fileURLToPath(
    new URL("../node_modules/.bin/wrangler", import.meta.url),
  );
  const database = (binding) => ({
    all: async (sql) =>
      JSON.parse(
        execFileSync(
          wrangler,
          ["d1", "execute", binding, ...flags, "--json", "--command", sql],
          { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
        ),
      )[0].results,
  });
  const counts = await reconcile({
    main: database("DB"),
    tombstones: database("TOMBSTONES"),
  });
  console.log(JSON.stringify(counts));
  // A restore must not start while anything is still pending.
  if (counts.unknown) process.exitCode = 1;
}
