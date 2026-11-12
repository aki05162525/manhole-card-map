import type { Context, Route } from "./app";
import { active, canonical, excluded, spellings } from "./card-ids";
import { HttpError, json } from "./http";
import { longerThan } from "./input";
import { limitWrites } from "./rate-limit";
import { ME, readAsUser, requireSession } from "./session";
import { japanDate } from "./time";

type Row = {
  card_id: string;
  received_on: string | null;
  memo: string | null;
  updated_at: number;
};
const detail = (row: Row) => ({
  cardId: canonical(row.card_id),
  receivedOn: row.received_on,
  memo: row.memo,
  updatedAt: row.updated_at,
});

function input(body: unknown, now: number) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "invalid_record");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "receivedOn" && key !== "memo"))
    throw new HttpError(400, "invalid_record");
  const { receivedOn, memo } = value;
  if (receivedOn !== undefined && receivedOn !== null) {
    if (
      typeof receivedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) ||
      receivedOn.startsWith("0000") ||
      receivedOn > japanDate(now)
    )
      throw new HttpError(400, "invalid_received_on");
    const date = new Date(receivedOn + "T00:00:00Z");
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== receivedOn
    )
      throw new HttpError(400, "invalid_received_on");
  }
  if (memo !== undefined && memo !== null) {
    if (typeof memo !== "string" || longerThan(memo, 500))
      throw new HttpError(400, "invalid_memo");
  }
  return {
    receivedOn: receivedOn as string | null | undefined,
    memo: memo as string | null | undefined,
  };
}

const known = (cardId: string) => active.has(cardId) || excluded.has(cardId);
const spelled = (cardId: string) => spellings.get(cardId) ?? [cardId];
// The placeholders of a card's spellings, numbered from `from`.
const placeholders = (ids: string[], from: number) =>
  ids.map((_, index) => `?${from + index}`).join(", ");
// DA-4: never choose one of two records or discard either one's fields.
function single(results: Row[]) {
  if (results.length > 1) throw new HttpError(409, "record_alias_collision");
  return results[0];
}

async function target(context: Context) {
  const { userId } = await requireSession(context);
  const cardId = canonical(context.params.cardId!);
  if (!known(cardId)) throw new HttpError(404, "not_found");
  const ids = spelled(cardId);
  const { results } = await context.env.DB.prepare(
    `SELECT card_id, received_on, memo, updated_at FROM records WHERE user_id = ?1 AND card_id IN (${placeholders(ids, 2)})`,
  )
    .bind(userId, ...ids)
    .all<Row>();
  return { userId, cardId, row: single(results) };
}

export const recordRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me/records",
    handle: async (context) => {
      const {
        session: { userId },
        rows: [results],
      } = await readAsUser<[Pick<Row, "card_id" | "received_on">]>(context, [
        `SELECT card_id, received_on FROM records WHERE user_id = ${ME} ORDER BY card_id`,
      ]);
      const seen = new Set<string>();
      const records = results.map((row) => {
        const cardId = canonical(row.card_id);
        if (seen.has(cardId))
          console.warn(
            JSON.stringify({
              route: "GET /api/me/records",
              error: "record_alias_collision",
              user: userId,
            }),
          );
        seen.add(cardId);
        return { cardId, receivedOn: row.received_on };
      });
      return json(records);
    },
  },
  {
    method: "GET",
    path: "/api/me/records/:cardId",
    // PF-6: the session and the record in one round trip, as the list.
    handle: async (context) => {
      const cardId = canonical(context.params.cardId!);
      if (!known(cardId)) {
        await requireSession(context);
        throw new HttpError(404, "not_found");
      }
      const ids = spelled(cardId);
      const {
        rows: [results],
      } = await readAsUser<[Row]>(context, [
        `SELECT card_id, received_on, memo, updated_at FROM records WHERE user_id = ${ME} AND card_id IN (${placeholders(ids, 3)})`,
        ...ids,
      ]);
      const row = single(results);
      if (!row) throw new HttpError(404, "not_found");
      return json(detail(row));
    },
  },
  {
    method: "PUT",
    path: "/api/me/records/:cardId",
    handle: async (context) => {
      const { userId, cardId, row } = await target(context);
      const value = input(context.body, context.now);
      if (!active.has(cardId) && !row) throw new HttpError(404, "not_found");
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
        saved = await db
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
          )
          .first<Row>();
      }
      saved ??= await db
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
        )
        .first<Row>();
      if (!saved) throw new HttpError(404, "not_found");
      return json({
        cardId,
        receivedOn: saved.received_on,
        updatedAt: saved.updated_at,
      });
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
