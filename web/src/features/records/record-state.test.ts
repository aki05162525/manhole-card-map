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
  it("keeps the failure of a take-back sent before the card was read", () => {
    const taken = step(initialRecords, {
      type: "press",
      id: "a",
      record: null,
      receipt: null,
    });
    const failed = step(taken.state, {
      type: "save-failed",
      id: "a",
      step: taken.write?.step ?? -1,
      message: "失敗",
    });
    // Still unread: the receipt is held, and what failed before still shows.
    const held = press(failed.state, pressed);
    expect(held.receipt).toEqual(pressed);
    expect(detail(held.state)).toMatchObject({
      loaded: false,
      saveError: "失敗",
    });
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

describe("a receipt pressed while a card read before is read again", () => {
  // Reopened, the card draws what its last read found, and reads again.
  function reread(record: ReceiptDetail | null) {
    return step(loaded(record), { type: "load", id: "a" });
  }
  it("waits for that read, drawn as received until it answers", () => {
    const again = reread(null);
    const held = press(again.state, pressed);
    expect(held).toMatchObject({ receipt: pressed, notice: "" });
    expect(held.write).toBeUndefined();
    expect(held.read).toBeUndefined();
    // Not drawn as a confirmed record with no memo: the memo is unknown.
    expect(detail(held.state)).toMatchObject({ loaded: false });
  });
  it("sends nothing once it finds a record made elsewhere, and draws it", () => {
    const again = reread(null);
    const held = press(again.state, pressed);
    const found = step(held.state, {
      type: "read",
      id: "a",
      step: again.read ?? -1,
      record: elsewhere,
    });
    expect(found.write).toBeUndefined();
    expect(found.receipt).toEqual(elsewhere);
    expect(detail(found.state)).toMatchObject({
      record: elsewhere,
      loaded: true,
    });
  });
  it("sends it once that read finds no record", () => {
    const again = reread(null);
    const held = press(again.state, pressed);
    const found = step(held.state, {
      type: "read",
      id: "a",
      step: again.read ?? -1,
      record: null,
    });
    expect(found.write).toMatchObject({ record: pressed });
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
    const [first = -1, second = -1] = outcomes.map((outcome) => outcome.read);
    for (const late of [
      { type: "read", id: "a", step: first, record: elsewhere },
      { type: "read-failed", id: "a", step: first },
    ] as const)
      expect(step(state, late).state).toBe(state);
    const latest = step(state, {
      type: "read",
      id: "a",
      step: second,
      record: null,
    });
    expect(detail(latest.state).loaded).toBe(true);
  });
  it("leaves only the latest read to answer, whatever another card began between the two", () => {
    // Card b is read, then received while card a is read twice.
    const other = step(initialRecords, { type: "load", id: "b" });
    const found = step(other.state, {
      type: "read",
      id: "b",
      step: other.read ?? -1,
      record: null,
    });
    const first = step(found.state, { type: "load", id: "a" });
    const sent = step(first.state, {
      type: "press",
      id: "b",
      record: { ...pressed, cardId: "b" },
      receipt: null,
    });
    expect(sent.write).toBeDefined();
    const again = step(sent.state, { type: "load", id: "a" });
    const late = step(again.state, {
      type: "read",
      id: "a",
      step: first.read ?? -1,
      record: elsewhere,
    });
    expect(late.state).toBe(again.state);
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
    // One card of several holds a receipt.
    const other = step(initialRecords, { type: "load", id: "b" });
    const held = press(other.state, pressed);
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
  it("leaves no answer of a write begun before it to match one begun after", () => {
    const before = press(loaded(null), pressed);
    const written = before.write?.step ?? -1;
    // The next user reads the same card and receives it.
    const read = step(restart(before.state).state, { type: "load", id: "a" });
    const found = step(read.state, {
      type: "read",
      id: "a",
      step: read.read ?? -1,
      record: null,
    });
    const after = press(found.state, pressed);
    expect(after.write).toBeDefined();
    for (const late of [
      { type: "saved", id: "a", step: written, record: elsewhere },
      { type: "save-failed", id: "a", step: written, message: "失敗" },
    ] as const)
      expect(step(after.state, late).state).toBe(after.state);
  });
});

describe("the record panel closing", () => {
  // The panels of a card are not counted: one closing drops the receipt.
  it.each([
    ["its panel", 1],
    ["one of its two panels", 2],
  ])(
    "drops a held receipt a microtask after %s closed, when none has opened again",
    (_, panels) => {
      const viewed = run(
        Array.from({ length: panels }, (): RecordEvent => ({
          type: "view",
          id: "a",
        })),
      ).state;
      const held = press(viewed, pressed, null);
      const closed = step(held.state, { type: "unview", id: "a" });
      expect(closed.later).toMatchObject({ type: "left", id: "a" });
      const later = closed.later ?? { type: "left", id: "a", hold: -1 };
      const left = step(closed.state, later);
      expect(left.receipt).toBeNull();
      const found = step(left.state, {
        type: "read",
        id: "a",
        step: held.read ?? -1,
        record: null,
      });
      expect(found.write).toBeUndefined();
    },
  );
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
    const later = outcomes[2]?.later ?? { type: "left", id: "a", hold: -1 };
    expect(step(state, later).state).toBe(state);
    const found = step(state, {
      type: "read",
      id: "a",
      step: outcomes[3]?.read ?? -1,
      record: null,
    });
    expect(found.write).toMatchObject({ record: pressed });
  });
  it("sends nothing for a read that answers between the close and the microtask after", () => {
    const viewed = run([{ type: "view", id: "a" }]).state;
    const held = press(viewed, pressed, null);
    const closed = step(held.state, { type: "unview", id: "a" });
    // A read already queued answers before the microtask the close left.
    const found = step(closed.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: null,
    });
    expect(found.write).toBeUndefined();
    expect(found.receipt ?? null).toBeNull();
    const later = closed.later;
    expect(later).toBeDefined();
    if (!later) return;
    const left = step(found.state, later);
    expect(left.write).toBeUndefined();
    expect(left.state.cards.get("a")?.hold ?? null).toBeNull();
  });
  it("leaves a receipt held for the next user to a close of the user before", () => {
    const viewed = run([{ type: "view", id: "a" }]).state;
    const closed = step(press(viewed, pressed).state, {
      type: "unview",
      id: "a",
    });
    // Another user signs in before the microtask; they open the card and
    // press, and their own panel is closing (to mount again at once) as the
    // microtask of the user before comes.
    const after = run([{ type: "view", id: "a" }], restart(closed.state).state);
    const held = press(after.state, pressed);
    const theirs = step(held.state, { type: "unview", id: "a" });
    const later = closed.later;
    expect(later).toBeDefined();
    if (!later) return;
    const kept = step(theirs.state, later);
    expect(kept.state).toBe(theirs.state);
    expect(kept.receipt).toBeUndefined();
    const left = step(kept.state, { type: "view", id: "a" });
    const found = step(left.state, {
      type: "read",
      id: "a",
      step: held.read ?? -1,
      record: null,
    });
    expect(found.write).toMatchObject({ record: pressed });
  });
});

describe("a card's read", () => {
  it("finds no record in a 404", async () => {
    expect(await readRecord(new Response("{}", { status: 404 }))).toBeNull();
  });
  it("takes the record the Worker answers", async () => {
    const record = { ...elsewhere, updatedAt: 1 };
    expect(await readRecord(new Response(JSON.stringify(record)))).toEqual(
      record,
    );
  });
  // The Worker answers every field of a record (`RecordDetail`); a body
  // short of one is not its answer.
  it.each([
    ["a 200 of null", null],
    ["a record without its memo", { cardId: "a", receivedOn: null }],
    [
      "a record without its time",
      { cardId: "a", receivedOn: null, memo: null },
    ],
    [
      "a record whose card is not named",
      { cardId: 1, receivedOn: null, memo: null, updatedAt: 1 },
    ],
  ])("fails for %s", async (_, body) => {
    await expect(
      readRecord(new Response(JSON.stringify(body))),
    ).rejects.toThrow();
  });
});

describe("a write's answer", () => {
  it("takes the date the Worker saved", async () => {
    expect(
      await readSaved(
        new Response(
          JSON.stringify({ cardId: "a", receivedOn: null, updatedAt: 1 }),
        ),
        pressed,
      ),
    ).toEqual({ ...pressed, receivedOn: null });
  });
  it("reads no body for a deletion", async () => {
    expect(await readSaved(new Response(null, { status: 204 }), null)).toBe(
      null,
    );
  });
  it.each([
    // Whatever its body: only a success is a save.
    [
      "a 404",
      new Response('{"cardId":"a","receivedOn":null,"updatedAt":1}', {
        status: 404,
      }),
    ],
    ["a 200 of null", new Response("null")],
    // The save checked only the date before (Issue #342).
    ["a body of only the date", new Response('{"receivedOn":null}')],
    [
      "a body without its time",
      new Response('{"cardId":"a","receivedOn":null}'),
    ],
  ])("fails for %s", async (_, response) => {
    await expect(readSaved(response, pressed)).rejects.toThrow();
  });
});
