import { Check, ChevronRight, Minus } from "lucide-react";
import { useId } from "react";
import { receiptState } from "../../domain/records";
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
          ? `${friendName}さんの回収マップ`
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
      <legend>回収状況で絞り込む</legend>
      {(
        [
          ["all", "すべて"],
          ["received", "回収済み"],
          ["unreceived", "未回収"],
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
            回収状況
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
  all: "回収済み",
  some: "一部回収済み",
  none: "未回収",
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

/** The collected state beside the distribution status; it leads to the record panel. */
export function RecordJump({
  ids,
  onExpand,
}: {
  ids: string[];
  onExpand?: ((section: "record") => void) | undefined;
}) {
  const { phase, records } = useRecords();
  if (phase !== "ready" || !records) return null;
  const state = receiptState(ids, records);
  return (
    <button
      type="button"
      className="record-jump"
      onClick={(event) => {
        if (onExpand) onExpand("record");
        else
          event.currentTarget
            .closest(".card-detail-content")
            ?.querySelector(".record-editor")
            ?.scrollIntoView({ block: "start" });
      }}
    >
      <Badge state={state} />
      <span className="record-sr">、回収の記録へ</span>
      <ChevronRight size={14} aria-hidden="true" />
    </button>
  );
}
