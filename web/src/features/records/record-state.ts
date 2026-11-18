// What each card's record does next, as a pure step: given what the provider
// holds and what has happened (a read begun or answered, a press, a write
// answered, a detail opened or closed, a change of user), the state it holds
// next and what it does about it (read, write, check the session, draw).
// `records-provider.tsx` runs the steps and does the side effects; the order
// in which answers come back is tried here without a DOM.
//
// Kept in features/records, beside its only user: it draws the detail of the
// records' context (`RecordDetail`, its status text), and the layers below
// may not import a feature's types.
import type { Receipt } from "../../domain/records";
import {
  emptyDetail,
  type ReceiptDetail,
  type RecordDetail,
} from "./records-context";

export const SAVING = "保存中…";
export const SAVED = "保存しました";
export const TAKEN_BACK = "未入手に戻しました";
export const LOAD_FAILED = "記録を読み込めませんでした";
export const NOT_SAVED =
  "別のタブで利用者が替わったため、保存しませんでした。記録を読み込み直しています。";

/** What the card waits on, begun at `step`: an answer begun at another is dropped. */
type Waiting =
  | { kind: "read"; step: number }
  | {
      kind: "write";
      step: number;
      /** Drawn again if the write fails: the detail and summary before it. */
      rollback: { detail: RecordDetail; receipt: Receipt | null };
    };
/**
 * A receipt pressed before the card's read answered, and the summary's
 * receipt before it. It is sent only once the read finds no record: an
 * explicit null memo would clear one saved elsewhere.
 */
type Hold = { record: ReceiptDetail; receipt: Receipt | null };
type CardRecord = {
  detail: RecordDetail;
  waiting: Waiting | null;
  hold: Hold | null;
  /** How many times a record panel of the card has opened. */
  opened: number;
};
export type RecordsState = {
  /**
   * The step the next read or write begins at. It counts on through a
   * change of user, so no answer begun before it matches one after.
   */
  next: number;
  cards: ReadonlyMap<string, CardRecord>;
};
export const initialRecords: RecordsState = { next: 1, cards: new Map() };

type HoldEvent = {
  type: "hold";
  id: string;
  record: ReceiptDetail;
  receipt: Receipt | null;
};
type LeftEvent = { type: "left"; id: string; opened: number };
export type RecordEvent =
  /** A record panel of the card has opened. */
  | { type: "view"; id: string }
  /** A record panel of the card has closed (React may mount it again at once). */
  | { type: "unview"; id: string }
  /** A microtask after a panel closed, when the card's panels had opened `opened` times. */
  | LeftEvent
  /** Read the card's record. */
  | { type: "load"; id: string }
  /** The read begun at `step` answered: null for no record. */
  | { type: "read"; id: string; step: number; record: ReceiptDetail | null }
  | { type: "read-failed"; id: string; step: number }
  /**
   * Received (a record) or taken back (null); `receipt` is the summary's
   * receipt for the card now.
   */
  | {
      type: "press";
      id: string;
      record: ReceiptDetail | null;
      receipt: Receipt | null;
    }
  /** The press checked as a write would be, and found it may be sent. */
  | HoldEvent
  /** The write begun at `step` answered with what was saved. */
  | { type: "saved"; id: string; step: number; record: ReceiptDetail | null }
  | { type: "save-failed"; id: string; step: number; message: string };

export type Outcome = {
  state: RecordsState;
  /** The card's receipt in the summary from now on, if it changes. */
  receipt?: Receipt | null;
  /** The notification from now on, if it changes. */
  notice?: string;
  /** Read the card, and answer with `step`. */
  read?: number;
  /** Write the record (null deletes it), and answer with `step`. */
  write?: { step: number; record: ReceiptDetail | null };
  /**
   * Check the session as a write would be, though nothing is sent yet; if it
   * may be sent, step with this at once.
   */
  check?: HoldEvent;
  /** Step with this a microtask later, once React has mounted what it will. */
  later?: LeftEvent;
};

const NO_CARD: CardRecord = {
  detail: emptyDetail,
  waiting: null,
  hold: null,
  opened: 0,
};

function put(
  state: RecordsState,
  id: string,
  card: CardRecord,
  next = state.next,
): RecordsState {
  const cards = new Map(state.cards);
  cards.set(id, card);
  return { next, cards };
}

function load(state: RecordsState, id: string, card: CardRecord): Outcome {
  // A reopened detail uses the in-flight optimistic value and cannot read it away.
  if (card.detail.pending) return { state };
  const step = state.next;
  return {
    state: put(
      state,
      id,
      {
        ...card,
        waiting: { kind: "read", step },
        detail: { ...card.detail, loadError: "" },
      },
      step + 1,
    ),
    read: step,
  };
}

function send(
  state: RecordsState,
  id: string,
  card: CardRecord,
  record: ReceiptDetail | null,
  receipt: Receipt | null,
): Outcome {
  if (card.detail.pending) return { state };
  const step = state.next;
  return {
    state: put(
      state,
      id,
      {
        ...card,
        waiting: {
          kind: "write",
          step,
          rollback: { detail: card.detail, receipt },
        },
        detail: {
          ...emptyDetail,
          record,
          loaded: true,
          pending: true,
          status: SAVING,
        },
      },
      step + 1,
    ),
    receipt: record,
    notice: "",
    write: { step, record },
  };
}

/** The state after `event`, and what to do about it. */
export function step(state: RecordsState, event: RecordEvent): Outcome {
  const { id } = event;
  const card = state.cards.get(id) ?? NO_CARD;
  switch (event.type) {
    case "view":
      return { state: put(state, id, { ...card, opened: card.opened + 1 }) };
    case "unview":
      return {
        state,
        ...(card.hold && {
          later: { type: "left", id, opened: card.opened },
        }),
      };
    case "left":
      // Closed, and no panel opened again (as React does in development,
      // mounting a panel twice): a held receipt is never sent.
      if (card.opened !== event.opened || !card.hold) return { state };
      return {
        state: put(state, id, { ...card, hold: null }),
        receipt: card.hold.receipt,
      };
    case "load":
      return load(state, id, card);
    case "read": {
      const { waiting, hold } = card;
      if (waiting?.kind !== "read" || waiting.step !== event.step)
        return { state };
      const { record } = event;
      const read: Outcome = {
        state: put(state, id, {
          ...card,
          waiting: null,
          hold: null,
          detail: { ...emptyDetail, record, loaded: true },
        }),
        receipt: record,
      };
      // Already received: the press has nothing left to do.
      if (!hold || record) return read;
      const sent = send(
        read.state,
        id,
        read.state.cards.get(id) ?? NO_CARD,
        hold.record,
        null,
      );
      return { ...read, ...sent };
    }
    case "read-failed": {
      const { waiting, hold } = card;
      if (waiting?.kind !== "read" || waiting.step !== event.step)
        return { state };
      return {
        state: put(state, id, {
          ...card,
          waiting: null,
          hold: null,
          detail: { ...card.detail, loadError: LOAD_FAILED },
        }),
        ...(hold && { receipt: hold.receipt }),
      };
    }
    case "press": {
      const { record, receipt } = event;
      if (card.hold) {
        // A second press waits with the first; taking it back sends nothing.
        if (record) return { state };
        return {
          state: put(state, id, { ...card, hold: null }),
          receipt: card.hold.receipt,
        };
      }
      if (record && !card.detail.loaded)
        return { state, check: { type: "hold", id, record, receipt } };
      return send(state, id, card, record, receipt);
    }
    case "hold": {
      const held: CardRecord = {
        ...card,
        hold: { record: event.record, receipt: event.receipt },
      };
      const outcome: Outcome = {
        state: put(state, id, held),
        receipt: event.record,
        notice: "",
      };
      // A read already on its way answers for the press.
      if (card.waiting?.kind === "read") return outcome;
      return { ...outcome, ...load(outcome.state, id, held) };
    }
    case "saved": {
      const { waiting } = card;
      if (waiting?.kind !== "write" || waiting.step !== event.step)
        return { state };
      const { record } = event;
      return {
        state: put(state, id, {
          ...card,
          waiting: null,
          detail: {
            ...emptyDetail,
            record,
            loaded: true,
            status: record ? SAVED : TAKEN_BACK,
          },
        }),
        receipt: record,
      };
    }
    case "save-failed": {
      const { waiting } = card;
      if (waiting?.kind !== "write" || waiting.step !== event.step)
        return { state };
      const { rollback } = waiting;
      return {
        state: put(state, id, {
          ...card,
          waiting: null,
          detail: {
            ...rollback.detail,
            pending: false,
            status: "",
            saveError: event.message,
          },
        }),
        receipt: rollback.receipt,
        notice: `${id}：${event.message}`,
      };
    }
  }
}

/**
 * Starts again with no card's record (signed out, or as another user). The
 * notice tells of a receipt that was held for its read: a save not made.
 */
export function restart(state: RecordsState): {
  state: RecordsState;
  notice: string;
} {
  const held = [...state.cards.values()].some((card) => card.hold);
  return {
    state: { next: state.next, cards: new Map() },
    notice: held ? NOT_SAVED : "",
  };
}

/** The details drawn, by card. */
export function detailsOf(
  state: RecordsState,
): ReadonlyMap<string, RecordDetail> {
  return new Map(
    [...state.cards].map(([id, card]) => [id, card.detail] as const),
  );
}

/**
 * The record a card's read found: null for none (404). Any other answer that
 * is not one record (a 200 of `null` included) is a failed read.
 */
export async function readRecord(
  response: Response,
): Promise<ReceiptDetail | null> {
  if (response.status === 404) return null;
  const record: unknown = await response.json();
  if (!isRecordDetail(record)) throw new Error("invalid record");
  return record;
}
function isRecordDetail(value: unknown): value is ReceiptDetail {
  if (
    typeof value !== "object" ||
    value === null ||
    !("cardId" in value && "receivedOn" in value && "memo" in value)
  )
    return false;
  const { cardId, receivedOn, memo } = value;
  return (
    typeof cardId === "string" &&
    (receivedOn === null || typeof receivedOn === "string") &&
    (memo === null || typeof memo === "string")
  );
}
/** What a write of `sent` saved, as its answer tells (a date set by the Worker). */
export async function readSaved(
  response: Response,
  sent: ReceiptDetail | null,
): Promise<ReceiptDetail | null> {
  if (!response.ok) throw new Error(String(response.status));
  if (!sent) return sent;
  const saved: unknown = await response.json();
  if (typeof saved !== "object" || saved === null || !("receivedOn" in saved))
    throw new Error("invalid record");
  const { receivedOn } = saved;
  if (!(receivedOn === null || typeof receivedOn === "string"))
    throw new Error("invalid record");
  return { ...sent, receivedOn };
}
