import type { Context } from "./app";
import type { D1PreparedStatement } from "./env";
import { DAY } from "./time";

const KEEP_DAYS = 35;

type Kind = "account" | "credential" | "friendship" | "block";

// For a batch that ends with the change itself as `... RETURNING`: what
// `change` returns, true when that statement touched a row.
export const lastChanged = (results: unknown[]) =>
  (results.at(-1) as { results: unknown[] }).results.length ? true : undefined;

// Builds the statements that mark the change applied, for the change's own
// batch. `when` is an SQL condition (with ? placeholders for `values`) that
// holds exactly when the change will modify something; without it the mark
// is unconditional.
type Mark = (when?: string, ...values: unknown[]) => D1PreparedStatement[];

// Records a change that a Time Travel restore would undo (PR-6). The
// tombstone is written as 'pending' with a random change ID before the
// change; the change's batch also writes that ID to applied_changes in the
// main database, so the mark exists exactly when the change committed. The
// tombstone then becomes 'done' (and the mark goes) or, if the change did
// not happen, is dropped. Whatever cannot be settled here stays pending, and
// `scripts/reconcile-tombstones.mjs` settles it from the mark before any
// replay. Without the binding (local runs, before the database exists)
// nothing is recorded; with it, a failed first write stops the change.
//
// `change` returns undefined when it turned out to change nothing.
export async function recordChange<T>(
  context: Context,
  kind: Kind,
  subject: string,
  object: string | null,
  change: (mark: Mark) => Promise<T | undefined>,
) {
  const { DB, TOMBSTONES: db } = context.env;
  if (!db) return change(() => []);
  const changeId = crypto.randomUUID();
  const [, inserted] = (await db.batch([
    db
      .prepare("DELETE FROM tombstones WHERE created_at < ?")
      .bind(context.now - KEEP_DAYS * DAY),
    db
      .prepare(
        "INSERT INTO tombstones (kind, subject, object, created_at, state, change_id) VALUES (?, ?, ?, ?, 'pending', ?) RETURNING id",
      )
      .bind(kind, subject, object, context.now, changeId),
  ])) as [unknown, { results: { id: number }[] }];
  const id = inserted.results[0]!.id;
  const mark: Mark = (when = "1", ...values) => [
    DB.prepare("DELETE FROM applied_changes WHERE applied_at < ?").bind(
      context.now - KEEP_DAYS * DAY,
    ),
    DB.prepare(
      `INSERT INTO applied_changes (change_id, applied_at) SELECT ?, ? WHERE ${when}`,
    ).bind(changeId, context.now, ...values),
  ];
  // Any failure from here leaves the tombstone pending for reconciliation.
  const attempt = async (step: () => Promise<unknown>) => {
    try {
      await step();
      return true;
    } catch {
      context.events.push("tombstone_left_pending");
      return false;
    }
  };
  const drop = () =>
    attempt(() =>
      db
        .prepare("DELETE FROM tombstones WHERE id = ? AND state = 'pending'")
        .bind(id)
        .run(),
    );
  const settle = async () => {
    if (
      await attempt(() =>
        db
          .prepare("UPDATE tombstones SET state = 'done' WHERE id = ?")
          .bind(id)
          .run(),
      )
    )
      await attempt(() =>
        DB.prepare("DELETE FROM applied_changes WHERE change_id = ?")
          .bind(changeId)
          .run(),
      );
  };
  let changed: T | undefined;
  try {
    changed = await change(mark);
  } catch (error) {
    // The batch may have committed even though the call failed: only the
    // mark tells.
    let applied: boolean | undefined;
    await attempt(async () => {
      applied = !!(await DB.prepare(
        "SELECT 1 FROM applied_changes WHERE change_id = ?",
      )
        .bind(changeId)
        .first());
    });
    if (applied === true) await settle();
    else if (applied === false) await drop();
    throw error;
  }
  if (changed === undefined) await drop();
  else await settle();
  return changed;
}
