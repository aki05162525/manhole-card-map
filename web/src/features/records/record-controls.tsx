import { useId, useRef, useState } from "react";
import { japanToday, receiptState } from "../../domain/records";
import { useRecords } from "./records-context";

export function RecordFilter({
  onChange,
  showFriend = false,
}: {
  onChange?(): void;
  showFriend?: boolean;
}) {
  const { phase, filter, setFilter, notification, friendName } = useRecords();
  const name = useId();
  const friendNotice =
    showFriend && friendName !== undefined ? (
      <p className="record-notice" role="status">
        {phase === "ready"
          ? `${friendName}さんの入手マップ`
          : phase === "failed"
            ? "表示できません"
            : "フレンドの記録を読み込み中…"}{" "}
        <a href="/friends">戻る</a>
      </p>
    ) : null;
  if (friendName !== undefined && phase !== "ready") return friendNotice;
  if (phase !== "ready")
    return (
      <p className="record-notice" role="status">
        {phase === "failed"
          ? "記録を読み込めませんでした"
          : "記録を読み込み中…"}
      </p>
    );
  const segments = (
    <fieldset className="record-filter">
      <legend>入手状況で絞り込む</legend>
      {(
        [
          ["all", "すべて"],
          ["received", "入手済み"],
          ["unreceived", "未入手"],
        ] as const
      ).map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={filter === value}
            onChange={() => {
              setFilter(value);
              onChange?.();
            }}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
  return (
    <>
      {friendNotice}
      {notification && (
        <p className="record-notice" role="alert">
          {notification}
        </p>
      )}
      {segments}
    </>
  );
}

const badgeLabels = {
  all: "入手済み",
  some: "一部入手済み",
  none: "未入手",
} as const;
// The detail's stamp, small: its red ring once received, and the empty slot
// a stamp is still to be pressed into.
const badgeMarks = { all: "済", some: "一部", none: "" } as const;
function Badge({
  state,
  date,
}: {
  state: keyof typeof badgeLabels;
  date?: string | null | undefined;
}) {
  const stamp = (
    <span className="record-badge" data-state={state}>
      <span aria-hidden="true">{badgeMarks[state]}</span>
      <span className="record-sr">{badgeLabels[state]}</span>
    </span>
  );
  // The day beside the stamp, as a dated stamp prints it.
  return date ? (
    <span className="record-dated">
      {stamp}
      <StampDate value={date} />
    </span>
  ) : (
    stamp
  );
}
/** Names the column of stamps in a list, where there are stamps to show. */
export function RecordColumn() {
  return useRecords().records ? <span>入手</span> : null;
}
export function RecordBadge({
  ids,
  dated = false,
}: {
  ids: string[];
  /** With the day a single card was received, where it was recorded. */
  dated?: boolean;
}) {
  const { records } = useRecords();
  if (!records) return null;
  return (
    <Badge
      state={receiptState(ids, records)}
      date={dated && ids.length === 1 ? records.get(ids[0])?.receivedOn : null}
    />
  );
}

/**
 * The date as a stamp prints it, short enough for one line and with nothing
 * to break at. The small stamp of the map's summary drops the century in CSS;
 * the date is read out in words either way.
 */
function StampDate({ value }: { value: string }) {
  const [year = "", month = "", day = ""] = value.split("-");
  return (
    <time dateTime={value}>
      <span className="record-sr">
        {Number(year)}年{Number(month)}月{Number(day)}日
      </span>
      <span aria-hidden="true">
        <span className="record-stamp-century">{year.slice(0, -2)}</span>
        {year.slice(-2)}.{month}.{day}
      </span>
    </time>
  );
}

/**
 * In the heading stamp slot. An unreceived card is recorded in one press,
 * dated today; a received one leads to the record panel (`onExpand`, which
 * the detail opens it with). A friend's map only shows their state.
 */
export function RecordAction({
  id,
  onExpand,
}: {
  id: string;
  onExpand?: ((section: "record") => void) | undefined;
}) {
  const { owner, phase, records, details, friendName, save } = useRecords();
  // Offer to take back only what this press recorded.
  const [recorded, setRecorded] = useState<string | null>(null);
  // The stamp comes down once. Cleared when it has, or a screen that was
  // hidden and is shown again would play it a second time.
  const [landing, setLanding] = useState(false);
  // For the owner of the records it was pressed on only.
  const [pressedAs, setPressedAs] = useState(owner);
  if (pressedAs !== owner || (phase !== "ready" && recorded !== null)) {
    setPressedAs(owner);
    setRecorded(null);
  }
  const button = useRef<HTMLButtonElement>(null);
  if (phase !== "ready" || !records) return null;
  const state = receiptState([id], records);
  const detail = details.get(id);
  // As in the record panel: after a failed read, no receipt until reloaded.
  const unread = detail !== undefined && !detail.loaded && detail.loadError;
  const receive = state === "none" && !unread;
  const undoable = state === "all" && recorded === id;
  const date = records.get(id)?.receivedOn;
  const mark =
    state === "all" ? (
      <>
        <strong>入手済</strong>
        {date && <StampDate value={date} />}
      </>
    ) : friendName !== undefined ? (
      "未入手"
    ) : (
      "入手したら押す"
    );
  if (friendName !== undefined)
    return (
      <span className="record-stamp" data-state={state}>
        {mark}
      </span>
    );
  if (unread) return null;
  return (
    <span
      className="record-quick-row"
      data-fresh={undoable && landing ? "" : undefined}
      onAnimationEnd={() => setLanding(false)}
    >
      <button
        ref={button}
        type="button"
        className="record-stamp"
        data-state={receive ? "receive" : state}
        onClick={() => {
          if (receive) {
            setRecorded(id);
            setLanding(true);
            void save(id, {
              cardId: id,
              receivedOn: japanToday(),
              memo: null,
            });
          } else {
            setRecorded(null);
            onExpand?.("record");
          }
        }}
      >
        {mark}
        {state === "all" && <span className="record-sr">、入手の記録へ</span>}
      </button>
      {/* A line of the heading, under the card's number: the stamp stays
          whole. Always mounted, so that what it comes to say is announced. */}
      <span className="record-stamp-note">
        <span role="status">
          {undoable && (
            <>
              <span className="record-sr">入手済みとして</span>
              記録しました
            </>
          )}
        </span>
        {undoable && (
          <button
            type="button"
            className="record-quick-undo"
            onClick={() => {
              setRecorded(null);
              void save(id, null);
              // This button disappears; keep focus on the one that remains.
              button.current?.focus();
            }}
          >
            取り消す
          </button>
        )}
      </span>
    </span>
  );
}
