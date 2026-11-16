import { Check, Minus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { sessionMark } from "../../shared/browser/signed-in";
import { japanToday, receiptState } from "../../domain/records";
import { useRecords } from "./records-context";

export function RecordFilter({
  onChange,
  showFriend = false,
  caption = false,
}: {
  onChange?(): void;
  showFriend?: boolean;
  /** Add a visible label beside the segments where no search bar explains them. */
  caption?: boolean;
}) {
  const { phase, filter, setFilter, notification, friendName } = useRecords();
  const name = useId();
  if (phase === "signed-out") return null;
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
      {caption ? (
        <div className="record-filter-row">
          <span className="record-filter-caption" aria-hidden="true">
            入手状況
          </span>
          {segments}
        </div>
      ) : (
        segments
      )}
    </>
  );
}

const badgeLabels = {
  all: "入手済み",
  some: "一部入手済み",
  none: "未入手",
} as const;
function Badge({ state }: { state: keyof typeof badgeLabels }) {
  return (
    <span className="status-chip record-badge" data-state={state}>
      {state === "all" ? (
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      ) : state === "some" ? (
        <Minus size={12} strokeWidth={3} aria-hidden="true" />
      ) : null}
      {badgeLabels[state]}
    </span>
  );
}
export function RecordBadge({ ids }: { ids: string[] }) {
  const { records } = useRecords();
  if (!records) return null;
  return <Badge state={receiptState(ids, records)} />;
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
 * dated today; a received one leads to the record panel. A friend's map only
 * shows their state.
 */
export function RecordAction({
  ids,
  onExpand,
}: {
  ids: string[];
  onExpand?: ((section: "record") => void) | undefined;
}) {
  const { phase, records, details, friendName, save } = useRecords();
  // Offer to take back only what this press recorded.
  const [recorded, setRecorded] = useState<string | null>(null);
  // The stamp comes down once. Cleared when it has, or a screen that was
  // hidden and is shown again would play it a second time.
  const [landing, setLanding] = useState(false);
  const user = sessionMark();
  const [owner, setOwner] = useState(user);
  if (owner !== user || (phase !== "ready" && recorded !== null)) {
    setOwner(user);
    setRecorded(null);
  }
  const button = useRef<HTMLButtonElement>(null);
  if (phase !== "ready" || !records) return null;
  const state = receiptState(ids, records);
  const [id] = ids;
  const detail = id === undefined ? undefined : details.get(id);
  // As in the record panel: after a failed read, no receipt until reloaded.
  const unread = detail !== undefined && !detail.loaded && detail.loadError;
  const receive =
    state === "none" &&
    friendName === undefined &&
    ids.length === 1 &&
    !unread &&
    id;
  const undoable = state === "all" && recorded !== null && recorded === id;
  const date = id ? records.get(id)?.receivedOn : null;
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
        onClick={(event) => {
          if (receive) {
            setRecorded(receive);
            setLanding(true);
            void save(receive, {
              cardId: receive,
              receivedOn: japanToday(),
              memo: null,
            });
          } else if (onExpand) {
            setRecorded(null);
            onExpand("record");
          } else {
            const editor = event.currentTarget
              .closest(".card-detail-content")
              ?.querySelector(".record-editor");
            editor?.scrollIntoView({ block: "start" });
            editor?.querySelector<HTMLElement>(".record-title")?.focus();
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
              void save(recorded, null);
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
