import type { Context, Route } from "./app";
import { active, canonical, excluded, spellings } from "./card-ids";
import { HttpError, json } from "./http";
import { limitWrites } from "./rate-limit";
import { requireSession } from "./session";

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
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
    const today = new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (
      typeof receivedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) ||
      receivedOn.startsWith("0000") ||
      receivedOn > today
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
    if (typeof memo !== "string") throw new HttpError(400, "invalid_memo");
    let length = 0;
    for (const _ of segmenter.segment(memo)) {
      if (++length > 500) throw new HttpError(400, "invalid_memo");
    }
  }
  return {
    receivedOn: receivedOn as string | null | undefined,
    memo: memo as string | null | undefined,
  };
}

async function target(context: Context) {
  const { userId } = await requireSession(context);
  const cardId = canonical(context.params.cardId!);
  if (!active.has(cardId) && !excluded.has(cardId))
    throw new HttpError(404, "not_found");
  const ids = spellings.get(cardId) ?? [cardId];
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await context.env.DB.prepare(
    `SELECT card_id, received_on, memo, updated_at FROM records WHERE user_id = ? AND card_id IN (${placeholders})`,
  )
    .bind(userId, ...ids)
    .all<Row>();
  // DA-4: never choose one of two records or discard either one's fields.
  if (results.length > 1) throw new HttpError(409, "record_alias_collision");
  return { userId, cardId, row: results[0] };
}

export const recordRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me/records",
    handle: async (context) => {
      const { userId } = await requireSession(context);
      const { results } = await context.env.DB.prepare(
        "SELECT card_id, received_on FROM records WHERE user_id = ? ORDER BY card_id",
      )
        .bind(userId)
        .all<Pick<Row, "card_id" | "received_on">>();
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
    handle: async (context) => {
      const { row } = await target(context);
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
