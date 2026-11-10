import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Settles tombstones left 'pending' by a change that failed half way
// (PR-6). Run before replaying tombstones after a Time Travel restore, with
// the main database as it is before the restore. A record whose change
// holds becomes 'done'; one whose change did not happen is removed. Records
// this script cannot check stay pending and are counted as unknown.

// wrangler d1 execute takes no parameters, so values are checked and
// inlined. User IDs are short base64url; credential IDs are base64url of up
// to 1023 bytes, the limit the Worker enforces when registering.
const userId = /^[A-Za-z0-9_-]{1,64}$/;
const credentialId = /^[A-Za-z0-9_-]{1,1364}$/;

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

// For each kind: the query that finds the changed row, and whether the
// change holds when a row is found.
const kinds = {
  account: {
    valid: ({ subject }) => userId.test(subject),
    query: ({ subject }) => `SELECT 1 FROM users WHERE id = '${subject}'`,
    holdsWhenFound: false,
  },
  credential: {
    valid: ({ subject }) => credentialId.test(subject),
    query: ({ subject }) => `SELECT 1 FROM credentials WHERE id = '${subject}'`,
    holdsWhenFound: false,
  },
  friendship: {
    valid: ({ subject, object }) => userId.test(subject) && userId.test(object),
    query: ({ subject, object }) => {
      const [a, b] = pair(subject, object);
      return `SELECT 1 FROM friendships WHERE user_a = '${a}' AND user_b = '${b}'`;
    },
    holdsWhenFound: false,
  },
  // A block adds a row; it holds while the row is there.
  block: {
    valid: ({ subject, object }) => userId.test(subject) && userId.test(object),
    query: ({ subject, object }) =>
      `SELECT 1 FROM blocks WHERE blocker_id = '${subject}' AND blocked_id = '${object}'`,
    holdsWhenFound: true,
  },
};

export async function reconcile({ main, tombstones, dryRun = false }) {
  const counts = { done: 0, removed: 0, unknown: 0 };
  const pending = await tombstones.all(
    "SELECT id, kind, subject, object FROM tombstones WHERE state = 'pending' ORDER BY id",
  );
  for (const record of pending) {
    const kind = kinds[record.kind];
    if (
      !kind ||
      !Number.isInteger(record.id) ||
      typeof record.subject !== "string" ||
      !kind.valid(record)
    ) {
      counts.unknown++;
      continue;
    }
    const found = (await main.all(kind.query(record))).length > 0;
    if (found === kind.holdsWhenFound) {
      counts.done++;
      if (!dryRun)
        await tombstones.all(
          `UPDATE tombstones SET state = 'done' WHERE id = ${record.id} AND state = 'pending'`,
        );
    } else {
      counts.removed++;
      if (!dryRun)
        await tombstones.all(
          `DELETE FROM tombstones WHERE id = ${record.id} AND state = 'pending'`,
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
