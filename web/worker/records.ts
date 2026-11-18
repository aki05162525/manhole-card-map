import { isReceiptDate, memoTooLong } from "../src/contract/records";
import type {
  Receipt,
  RecordDetail,
  SavedRecord,
} from "../src/contract/private-api";
import type { Context, Route } from "./app";
import { active, canonical, excluded, spellings } from "./card-ids";
import { HttpError, json } from "./http";
import { field } from "./input";
import { limitWrites } from "./rate-limit";
import { all, columns, first, rows, type RowOf } from "./rows";
import { ME, readAsUser, requireSession } from "./session";
import { japanDate } from "./time";

// Selected, or returned, as `card_id, received_on, memo, updated_at`.
const recordRow = columns({
  card_id: "text",
  received_on: "text?",
  memo: "text?",
  updated_at: "integer",
});
type Row = RowOf<typeof recordRow>;
const detail = (row: Row): RecordDetail => ({
  cardId: canonical(row.card_id),
  receivedOn: row.received_on,
  memo: row.memo,
  updatedAt: row.updated_at,
});

function input(body: unknown, now: number) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError("invalid_record");
  if (Object.keys(body).some((key) => key !== "receivedOn" && key !== "memo"))
    throw new HttpError("invalid_record");
  const receivedOn = field(body, "receivedOn");
  const memo = field(body, "memo");
  // Omitted keeps a record's value, null clears it; "" is not a date.
  const unset = (field: unknown) => field === undefined || field === null;
  if (
    !unset(receivedOn) &&
    (typeof receivedOn !== "string" ||
      !isReceiptDate(receivedOn, japanDate(now)))
  )
    throw new HttpError("invalid_received_on");
  if (!unset(memo) && (typeof memo !== "string" || memoTooLong(memo)))
    throw new HttpError("invalid_memo");
  return { receivedOn, memo };
}

const known = (cardId: string) => active.has(cardId) || excluded.has(cardId);
const spelled = (cardId: string) => spellings.get(cardId) ?? [cardId];
// The placeholders of a card's spellings, numbered from `from`.
const placeholders = (ids: string[], from: number) =>
  ids.map((_, index) => `?${from + index}`).join(", ");
// DA-4: never choose one of two records or discard either one's fields.
function single(results: Row[]) {
  if (results.length > 1) throw new HttpError("record_alias_collision");
  return results[0];
}

async function target(context: Context) {
  const { userId } = await requireSession(context);
  const cardId = canonical(context.params.cardId);
  if (!known(cardId)) throw new HttpError("not_found");
  const ids = spelled(cardId);
  const results = await all(
    context.env.DB.prepare(
      `SELECT card_id, received_on, memo, updated_at FROM records WHERE user_id = ?1 AND card_id IN (${placeholders(ids, 2)})`,
    ).bind(userId, ...ids),
    recordRow,
  );
  return { userId, cardId, row: single(results) };
}

export const recordRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me/records",
    handle: async (context) => {
      const {
        results: [results],
      } = await readAsUser(context, [
        `SELECT card_id, received_on FROM records WHERE user_id = ${ME} ORDER BY card_id`,
      ]);
      const seen = new Set<string>();
      const read = columns({ card_id: "text", received_on: "text?" });
      const records = rows(read, results).map((row): Receipt => {
        const cardId = canonical(row.card_id);
        seen.add(cardId);
        return { cardId, receivedOn: row.received_on };
      });
      if (seen.size < records.length)
        context.events.push("record_alias_collision");
      return json(records);
    },
  },
  {
    method: "GET",
    path: "/api/me/records/:cardId",
    // PF-6: the session and the record in one round trip, as the list.
    handle: async (context) => {
      const cardId = canonical(context.params.cardId);
      if (!known(cardId)) {
        await requireSession(context);
        throw new HttpError("not_found");
      }
      const ids = spelled(cardId);
      const {
        results: [results],
      } = await readAsUser(context, [
        `SELECT card_id, received_on, memo, updated_at FROM records WHERE user_id = ${ME} AND card_id IN (${placeholders(ids, 3)})`,
        ...ids,
      ]);
      const row = single(rows(recordRow, results));
      if (!row) throw new HttpError("not_found");
      return json(detail(row));
    },
  },
  {
    method: "PUT",
    path: "/api/me/records/:cardId",
    handle: async (context) => {
      const { userId, cardId, row } = await target(context);
      const value = input(context.body, context.now);
      if (!active.has(cardId) && !row) throw new HttpError("not_found");
      await limitWrites(context, userId);
      // Keep omitted fields at their value when the statement runs, not when
      // `target` read the row, so concurrent partial updates do not undo each other.
      const keepDate = value.receivedOn === undefined ? 1 : 0;
      const keepMemo = value.memo === undefined ? 1 : 0;
      const receivedOn = value.receivedOn ?? null;
      const memo = value.memo ?? null;
      const db = context.env.DB;
      let saved: Row | null = null;
      if (row && row.card_id !== cardId) {
        saved = await first(
          db
            .prepare(
              "UPDATE records SET card_id = ?, received_on = CASE WHEN ? THEN received_on ELSE ? END, memo = CASE WHEN ? THEN memo ELSE ? END, updated_at = ? WHERE user_id = ? AND card_id = ? RETURNING card_id, received_on, memo, updated_at",
            )
            .bind(
              cardId,
              keepDate,
              receivedOn,
              keepMemo,
              memo,
              context.now,
              userId,
              row.card_id,
            ),
          recordRow,
        );
      }
      saved ??= await first(
        db
          .prepare(
            "INSERT INTO records (user_id, card_id, received_on, memo, updated_at) SELECT ?, ?, ?, ?, ? WHERE ? OR EXISTS (SELECT 1 FROM records WHERE user_id = ? AND card_id = ?) ON CONFLICT (user_id, card_id) DO UPDATE SET received_on = CASE WHEN ? THEN records.received_on ELSE excluded.received_on END, memo = CASE WHEN ? THEN records.memo ELSE excluded.memo END, updated_at = excluded.updated_at RETURNING card_id, received_on, memo, updated_at",
          )
          .bind(
            userId,
            cardId,
            receivedOn,
            memo,
            context.now,
            active.has(cardId) ? 1 : 0,
            userId,
            cardId,
            keepDate,
            keepMemo,
          ),
        recordRow,
      );
      if (!saved) throw new HttpError("not_found");
      return json({
        cardId,
        receivedOn: saved.received_on,
        updatedAt: saved.updated_at,
      } satisfies SavedRecord);
    },
  },
  {
    method: "DELETE",
    path: "/api/me/records/:cardId",
    handle: async (context) => {
      const { userId, row } = await target(context);
      await limitWrites(context, userId);
      if (row)
        await context.env.DB.prepare(
          "DELETE FROM records WHERE user_id = ? AND card_id = ?",
        )
          .bind(userId, row.card_id)
          .run();
      return new Response(null, { status: 204 });
    },
  },
];
