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
import { isRecordDetail, isSavedRecord } from "../../contract/private-api";
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
 * A receipt pressed before the card's read answered (on the first open, or
 * on a later one while the card found unreceived is read again), and the
 * summary's receipt before it. It is sent only once the read finds no
 * record: an explicit null memo would clear one saved elsewhere.
 */
type Hold = {
  /**
   * Numbered from `next`, as reads and writes are, so a close (`left`)
   * drops only the hold it saw, never one held after a change of user.
   */
  step: number;
  record: ReceiptDetail;
  receipt: Receipt | null;
  /**
   * A record panel of the card has closed since, and none has opened again:
   * never sent, and dropped a microtask later (`left`) unless one opens.
   */
  closed: boolean;
};
type CardRecord = {
  detail: RecordDetail;
  waiting: Waiting | null;
  hold: Hold | null;
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
type LeftEvent = { type: "left"; id: string; hold: number };
export type RecordEvent =
  /** A record panel of the card has opened. */
  | { type: "view"; id: string }
  /** A record panel of the card has closed (React may mount it again at once). */
  | { type: "unview"; id: string }
  /** A microtask after a panel closed with the receipt held at `hold`. */
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

const NO_CARD: CardRecord = { detail: emptyDetail, waiting: null, hold: null };

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
      // Opened again at once, as React mounts a panel twice in development:
      // the receipt held may be sent after all.
      if (!card.hold?.closed) return { state };
      return {
        state: put(state, id, {
          ...card,
          hold: { ...card.hold, closed: false },
        }),
      };
    case "unview": {
      // Closed: from now on the held receipt is never sent, though a read
      // already on its way may answer before the microtask below.
      const { hold } = card;
      if (!hold) return { state };
      return {
        state: put(state, id, { ...card, hold: { ...hold, closed: true } }),
        later: { type: "left", id, hold: hold.step },
      };
    }
    case "left": {
      // Closed, and no panel opened again: the hold goes.
      const { hold } = card;
      if (hold?.step !== event.hold || !hold.closed) return { state };
      return {
        state: put(state, id, { ...card, hold: null }),
        receipt: hold.receipt,
      };
    }
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
      // Already received, or closed since the press: nothing is sent.
      if (!hold || hold.closed || record) return read;
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
      // Received before the read answered, the memo saved elsewhere is
      // unknown: so too when a card found unreceived before is read again.
      const unread =
        !card.detail.loaded ||
        (card.waiting?.kind === "read" && !card.detail.record);
      if (record && unread)
        return { state, check: { type: "hold", id, record, receipt } };
      return send(state, id, card, record, receipt);
    }
    case "hold": {
      const held: CardRecord = {
        ...card,
        hold: {
          step: state.next,
          record: event.record,
          receipt: event.receipt,
          closed: false,
        },
        // Drawn as received from the summary, its memo waiting for the read,
        // not as the record found unreceived before.
        detail: emptyDetail,
      };
      const outcome: Outcome = {
        state: put(state, id, held, state.next + 1),
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
  // A hold closed already was not to be sent anyway.
  const held = [...state.cards.values()].some(
    (card) => card.hold && !card.hold.closed,
  );
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
 * is not the Worker's record (`isRecordDetail`; a 200 of `null` included) is
 * a failed read.
 */
export async function readRecord(
  response: Response,
): Promise<ReceiptDetail | null> {
  if (response.status === 404) return null;
  const record: unknown = await response.json();
  if (!isRecordDetail(record)) throw new Error("invalid record");
  return record;
}
/**
 * What a write of `sent` saved, as its answer tells (a date set by the
 * Worker). A deletion (`sent` null) answers 204 without a body.
 */
export async function readSaved(
  response: Response,
  sent: ReceiptDetail | null,
): Promise<ReceiptDetail | null> {
  if (!response.ok) throw new Error(String(response.status));
  if (!sent) return sent;
  const saved: unknown = await response.json();
  if (!isSavedRecord(saved)) throw new Error("invalid record");
  return { ...sent, receivedOn: saved.receivedOn };
}
