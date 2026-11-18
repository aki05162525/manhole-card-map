import { describe, expect, it } from "vitest";
import { emptyDetail, type ReceiptDetail } from "./records-context";
import {
  LOAD_FAILED,
  NOT_SAVED,
  SAVED,
  SAVING,
  TAKEN_BACK,
  initialRecords,
  readRecord,
  readSaved,
  restart,
  step,
  type Outcome,
  type RecordEvent,
  type RecordsState,
} from "./record-state";

const pressed: ReceiptDetail = {
  cardId: "a",
  receivedOn: "2026-11-18",
  memo: null,
};
const elsewhere: ReceiptDetail = {
  cardId: "a",
  receivedOn: "2026-11-02",
  memo: "別のタブのメモ",
};

/** Steps through `events` from `state`, keeping every outcome. */
function run(events: RecordEvent[], state: RecordsState = initialRecords) {
  const outcomes: Outcome[] = [];
  for (const event of events) {
    const outcome = step(state, event);
    outcomes.push(outcome);
    state = outcome.state;
  }
  return { state, outcomes, last: outcomes.at(-1) };
}
/** As the provider runs a press: the session check passes, and the hold steps at once. */
function press(
  state: RecordsState,
  record: ReceiptDetail | null,
  receipt: ReceiptDetail | null = null,
): Outcome {
  const outcome = step(state, { type: "press", id: "a", record, receipt });
  return outcome.check ? step(outcome.state, outcome.check) : outcome;
}
const detail = (state: RecordsState) =>
  state.cards.get("a")?.detail ?? emptyDetail;
/** A card read and found with `record`. */
function loaded(record: ReceiptDetail | null) {
  const begun = step(initialRecords, { type: "load", id: "a" });
  const read = begun.read ?? -1;
  return step(begun.state, { type: "read", id: "a", step: read, record }).state;
}

describe("a receipt pressed before the card's read answered", () => {
  it("waits for the read the panel began, and is sent once it finds no record", () => {
    const begun = step(initialRecords, { type: "load", id: "a" });
    const held = press(begun.state, pressed);
    // Drawn as received at once, with nothing sent and no second read.
    expect(held).toMatchObject({ receipt: pressed, notice: "" });
    expect(held.read).toBeUndefined();
    expect(held.write).toBeUndefined();
    const found = step(held.state, {
      type: "read",
      id: "a",
      step: begun.read ?? -1,
      record: null,
    });
    expect(found.write).toMatchObject({ record: pressed });
    expect(found.receipt).toEqual(pressed);
    expect(detail(found.state)).toMatchObject({
      record: pressed,
      pending: true,
      status: SAVING,
    });
  });
  it("reads the card itself when no read is on its way", () => {
    const held = press(initialRecords, pressed);
    expect(held.read).toBeTypeOf("number");
    expect(held.write).toBeUndefined();
  });
  it("is checked as a write would be before it is held", () => {
    const outcome = step(initialRecords, {
      type: "press",
      id: "a",
      record: pressed,
      receipt: null,
    });
    // Nothing is held until the session lets it be.
    expect(outcome.state).toBe(initialRecords);
    expect(outcome.check).toMatchObject({ type: "hold", record: pressed });
  });
  it("sends nothing for a card recorded elsewhere, and draws that record", () => {
    const held = press(initialRecords, pressed);
    const found = step(held.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: elsewhere,
    });
    expect(found.write).toBeUndefined();
    expect(found.receipt).toEqual(elsewhere);
    expect(detail(found.state)).toMatchObject({
      record: elsewhere,
      loaded: true,
    });
    expect(found.state.cards.get("a")?.hold).toBeNull();
  });
  it("is dropped with the read's failure, and the summary's receipt comes back", () => {
    const summary = { cardId: "a", receivedOn: null };
    const held = press(initialRecords, pressed, { ...summary, memo: null });
    const failed = step(held.state, {
      type: "read-failed",
      id: "a",
      step: held.read ?? -1,
    });
    expect(failed.write).toBeUndefined();
    expect(failed.receipt).toEqual({ ...summary, memo: null });
    expect(detail(failed.state)).toMatchObject({
      loaded: false,
      loadError: LOAD_FAILED,
    });
  });
});

describe("a press while the read is on its way", () => {
  it("waits with the first, and the read sends one write", () => {
    const held = press(initialRecords, pressed);
    const again = press(held.state, { ...pressed, receivedOn: "2026-11-17" });
    expect(again.state).toBe(held.state);
    const found = step(again.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: null,
    });
    expect(found.write).toEqual({ step: found.write?.step, record: pressed });
  });
  it("takes the hold back without sending anything", () => {
    const held = press(initialRecords, pressed);
    const back = press(held.state, null);
    expect(back).toMatchObject({ receipt: null });
    expect(back.write).toBeUndefined();
    const found = step(back.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: null,
    });
    expect(found.write).toBeUndefined();
  });
  it("leaves only the latest read to answer", () => {
    const { state, outcomes } = run([
      { type: "load", id: "a" },
      { type: "load", id: "a" },
    ]);
    const [first, second] = outcomes.map((outcome) => outcome.read ?? -1);
    const late = step(state, {
      type: "read",
      id: "a",
      step: first ?? -1,
      record: elsewhere,
    });
    expect(late.state).toBe(state);
    const latest = step(state, {
      type: "read",
      id: "a",
      step: second ?? -1,
      record: null,
    });
    expect(detail(latest.state).loaded).toBe(true);
  });
});

describe("a save", () => {
  it("is drawn at once and confirmed with what the Worker saved", () => {
    const sent = press(loaded(null), pressed);
    expect(sent).toMatchObject({ receipt: pressed, notice: "" });
    expect(detail(sent.state)).toMatchObject({ pending: true });
    const saved = step(sent.state, {
      type: "saved",
      id: "a",
      step: sent.write?.step ?? -1,
      record: { ...pressed, receivedOn: null },
    });
    expect(saved.receipt).toEqual({ ...pressed, receivedOn: null });
    expect(detail(saved.state)).toMatchObject({
      record: { ...pressed, receivedOn: null },
      pending: false,
      status: SAVED,
    });
  });
  it("rolls the detail and the summary back when it fails, and tells of it", () => {
    const before = loaded(elsewhere);
    const sent = press(before, null, elsewhere);
    const failed = step(sent.state, {
      type: "save-failed",
      id: "a",
      step: sent.write?.step ?? -1,
      message: "保存できませんでした",
    });
    expect(failed.receipt).toEqual(elsewhere);
    expect(failed.notice).toBe("a：保存できませんでした");
    expect(detail(failed.state)).toEqual({
      ...detail(before),
      saveError: "保存できませんでした",
    });
  });
  it("is not sent again while one is pending, nor read away", () => {
    const sent = press(loaded(null), pressed);
    expect(press(sent.state, null).state).toBe(sent.state);
    expect(step(sent.state, { type: "load", id: "a" }).state).toBe(sent.state);
  });
  it("takes a record back with a delete", () => {
    const sent = press(loaded(elsewhere), null, elsewhere);
    expect(sent.write).toMatchObject({ record: null });
    expect(sent.receipt).toBeNull();
    const saved = step(sent.state, {
      type: "saved",
      id: "a",
      step: sent.write?.step ?? -1,
      record: null,
    });
    expect(detail(saved.state)).toMatchObject({
      record: null,
      status: TAKEN_BACK,
    });
  });
});

describe("a change of user", () => {
  it("drops every card, and tells of a receipt held for its read", () => {
    const held = press(initialRecords, pressed);
    const restarted = restart(held.state);
    expect(restarted.notice).toBe(NOT_SAVED);
    expect(restarted.state.cards.size).toBe(0);
    expect(restart(loaded(null)).notice).toBe("");
  });
  it("leaves no answer begun before it to match one begun after", () => {
    const before = step(initialRecords, { type: "load", id: "a" });
    const after = step(restart(before.state).state, { type: "load", id: "a" });
    const late = step(after.state, {
      type: "read",
      id: "a",
      step: before.read ?? -1,
      record: elsewhere,
    });
    expect(late.state).toBe(after.state);
  });
});

describe("the record panel closing", () => {
  it("drops a held receipt a microtask later, when no panel has opened again", () => {
    const viewed = run([{ type: "view", id: "a" }]).state;
    const held = press(viewed, pressed, null);
    const closed = step(held.state, { type: "unview", id: "a" });
    expect(closed.later).toEqual({ type: "left", id: "a", opened: 1 });
    const left = step(closed.state, { type: "left", id: "a", opened: 1 });
    expect(left.receipt).toBeNull();
    const found = step(left.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: null,
    });
    expect(found.write).toBeUndefined();
  });
  it("keeps it when React mounts the panel again at once (StrictMode)", () => {
    // Pressed before the panel's effects ran; React then mounts the panel,
    // unmounts it and mounts it again, each mount reading the card.
    const held = press(initialRecords, pressed);
    const { state, outcomes } = run(
      [
        { type: "load", id: "a" },
        { type: "view", id: "a" },
        { type: "unview", id: "a" },
        { type: "load", id: "a" },
        { type: "view", id: "a" },
      ],
      held.state,
    );
    const later = outcomes[2]?.later ?? { type: "left", id: "a", opened: -1 };
    expect(step(state, later).state).toBe(state);
    const found = step(state, {
      type: "read",
      id: "a",
      step: outcomes[3]?.read ?? -1,
      record: null,
    });
    expect(found.write).toMatchObject({ record: pressed });
  });
  it("drops it when one of two panels of the card closes", () => {
    const { state } = run([
      { type: "view", id: "a" },
      { type: "view", id: "a" },
    ]);
    const held = press(state, pressed);
    const closed = step(held.state, { type: "unview", id: "a" });
    const later = closed.later ?? { type: "left", id: "a", opened: -1 };
    expect(step(closed.state, later).receipt).toBeNull();
  });
});

describe("a card's read", () => {
  it("finds no record in a 404", async () => {
    expect(await readRecord(new Response("{}", { status: 404 }))).toBeNull();
  });
  it("fails for a 200 of null, which is not a record", async () => {
    await expect(readRecord(new Response("null"))).rejects.toThrow();
  });
  it("fails for a record without its memo", async () => {
    await expect(
      readRecord(
        new Response(JSON.stringify({ cardId: "a", receivedOn: null })),
      ),
    ).rejects.toThrow();
  });
});

describe("a write's answer", () => {
  it("takes the date the Worker saved", async () => {
    expect(
      await readSaved(
        new Response(JSON.stringify({ cardId: "a", receivedOn: null })),
        pressed,
      ),
    ).toEqual({ ...pressed, receivedOn: null });
  });
  it("fails for a 404 and for a body without a date", async () => {
    await expect(
      readSaved(new Response("{}", { status: 404 }), pressed),
    ).rejects.toThrow();
    await expect(readSaved(new Response("null"), pressed)).rejects.toThrow();
  });
});
