import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Settles tombstones left 'pending' by a change that was not confirmed
// (PR-6). Run before replaying tombstones after a Time Travel restore, with
// the main database as it is before the restore. Every change writes its
// tombstone's change_id to applied_changes in the same batch as the change,
// so the mark exists exactly when the change committed: a marked record
// becomes 'done' and its mark goes; an unmarked one never happened and is
// removed. Nothing is inferred from the current rows, which later actions
// (an unblock, a new friendship) may have changed. A record without a
// usable change ID stays pending and is counted as unknown.

// crypto.randomUUID(); checked because wrangler d1 execute takes no
// parameters and the value is inlined.
const changeIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function reconcile({ main, tombstones, dryRun = false }) {
  const counts = { done: 0, removed: 0, unknown: 0 };
  const pending = await tombstones.all(
    "SELECT id, change_id FROM tombstones WHERE state = 'pending' ORDER BY id",
  );
  for (const { id, change_id: changeId } of pending) {
    if (!Number.isInteger(id) || !changeIdPattern.test(String(changeId))) {
      counts.unknown++;
      continue;
    }
    const marked = await main.all(
      `SELECT 1 FROM applied_changes WHERE change_id = '${changeId}'`,
    );
    if (marked.length) {
      counts.done++;
      if (dryRun) continue;
      await tombstones.all(
        `UPDATE tombstones SET state = 'done' WHERE id = ${id} AND state = 'pending'`,
      );
      await main.all(
        `DELETE FROM applied_changes WHERE change_id = '${changeId}'`,
      );
    } else {
      counts.removed++;
      if (!dryRun)
        await tombstones.all(
          `DELETE FROM tombstones WHERE id = ${id} AND state = 'pending'`,
        );
    }
  }
  return counts;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const flags = args.filter((arg) => arg !== "--dry-run");
  if (!flags.includes("--remote") && !flags.includes("--local"))
    throw new Error(
      "Usage: reconcile-tombstones.mjs (--remote | --local [--env dev]) [--dry-run]",
    );
  console.error(
    `Reconciling tombstones on ${flags.join(" ")}${dryRun ? " (dry run, no changes)" : ""}`,
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
    dryRun,
  });
  console.log(JSON.stringify(counts));
  // A restore must not start while anything is still pending.
  if (counts.unknown) process.exitCode = 1;
}
