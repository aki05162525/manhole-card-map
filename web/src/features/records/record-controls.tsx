import { useId } from "react";
import { receiptState } from "../../domain/records";
import { useRecords } from "./records-context";

export function RecordFilter({ onChange }: { onChange?(): void }) {
  const { phase, filter, setFilter } = useRecords();
  const name = useId();
  if (phase === "signed-out") return null;
  if (phase !== "ready")
    return (
      <p className="record-notice" role="status">
        {phase === "failed"
          ? "記録を読み込めませんでした"
          : "記録を読み込み中…"}
      </p>
    );
  return (
    <fieldset className="record-filter">
      <legend>受け取り記録で絞り込む</legend>
      {(
        [
          ["all", "すべて"],
          ["received", "受け取り済み"],
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
}
export function RecordBadge({ ids }: { ids: string[] }) {
  const { records } = useRecords();
  if (!records) return null;
  const state = receiptState(ids, records);
  return (
    <span className="record-badge">
      {state === "all"
        ? "✓ 受け取り済み"
        : state === "some"
          ? "一部受け取り済み"
          : "未回収"}
    </span>
  );
}
