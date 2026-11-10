import type { Context } from "./app";

const DAY = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 35;

type Kind = "account" | "credential" | "friendship" | "block";

// Records a change that a Time Travel restore would undo (PR-6). The row is
// written as 'pending' before the change and set to 'done' after it, so a
// replay after a restore applies only changes that happened. If the change
// fails the row is dropped; if that or the update fails too,
// `scripts/reconcile-tombstones.mjs` settles the pending row against the
// main database before any replay. Without the binding (local runs, before
// the database exists) nothing is recorded; with it, a failed first write
// stops the change.
//
// `change` returns undefined when it turned out to change nothing.
export async function recordChange<T>(
  context: Context,
  kind: Kind,
  subject: string,
  object: string | null,
  change: () => Promise<T | undefined>,
) {
  const db = context.env.TOMBSTONES;
  if (!db) return change();
  const [, inserted] = (await db.batch([
    db
      .prepare("DELETE FROM tombstones WHERE created_at < ?")
      .bind(context.now - KEEP_DAYS * DAY),
    db
      .prepare(
        "INSERT INTO tombstones (kind, subject, object, created_at, state) VALUES (?, ?, ?, ?, 'pending') RETURNING id",
      )
      .bind(kind, subject, object, context.now),
  ])) as [unknown, { results: { id: number }[] }];
  const id = inserted.results[0]!.id;
  // A failure here leaves the row pending for reconciliation.
  const settle = async (sql: string) => {
    try {
      await db.prepare(sql).bind(id).run();
    } catch {
      context.events.push("tombstone_left_pending");
    }
  };
  const cancel = () =>
    settle("DELETE FROM tombstones WHERE id = ? AND state = 'pending'");
  let changed: T | undefined;
  try {
    changed = await change();
  } catch (error) {
    await cancel();
    throw error;
  }
  if (changed === undefined) await cancel();
  else await settle("UPDATE tombstones SET state = 'done' WHERE id = ?");
  return changed;
}
