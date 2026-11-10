import { useEffect, useId, useState } from "react";
import { japanToday, memoLength, validReceiptDate } from "../../domain/records";
import { emptyDetail, useRecords } from "./records-context";

export function RecordEditor({ cardId }: { cardId: string }) {
  const { phase } = useRecords();
  return phase === "ready" ? <Editor key={cardId} cardId={cardId} /> : null;
}
function Editor({ cardId }: { cardId: string }) {
  const { details, load, save: saveRecord } = useRecords();
  const detail = details.get(cardId) ?? emptyDetail;
  const {
    record,
    loaded,
    pending: saving,
    status,
    loadError: error,
    saveError,
  } = detail;
  const [draft, setDraft] = useState(() => ({
    record,
    revision: detail.revision,
    receivedOn: record?.receivedOn ?? "",
    memo: record?.memo ?? "",
  }));
  const currentDraft =
    draft.record === record && draft.revision === detail.revision
      ? draft
      : {
          revision: detail.revision,
          record,
          receivedOn: record?.receivedOn ?? "",
          memo: record?.memo ?? "",
        };
  const { receivedOn, memo } = currentDraft;
  const [fieldError, setFieldError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const path = `/api/me/records/${encodeURIComponent(cardId)}`;
  useEffect(() => {
    void load(cardId);
  }, [cardId, load, attempt]);
  function save(next: typeof record) {
    setFieldError("");
    if (!saving) void saveRecord(cardId, next);
  }
  if (!loaded)
    return (
      <section className="record-editor" aria-label="受け取り記録">
        <p role="status">{error || "記録を読み込み中…"}</p>
        {error && (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            記録を再読み込み
          </button>
        )}
      </section>
    );
  return (
    <section className="record-editor" aria-label="受け取り記録">
      <h3>受け取り記録</h3>
      <p>{record ? "✓ 受け取り済み" : "未回収"}</p>
      {record ? (
        <form
          action={path}
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = !validReceiptDate(receivedOn)
              ? "受け取った日は今日以前の日付にしてください。"
              : memoLength(memo) > 500
                ? "メモは500文字以内にしてください。"
                : "";
            setFieldError(invalid);
            if (invalid) {
              event.currentTarget
                .querySelector<HTMLElement>(
                  !validReceiptDate(receivedOn) ? "input" : "textarea",
                )
                ?.focus();
              return;
            }
            void save({
              cardId,
              receivedOn: receivedOn || null,
              memo: memo || null,
            });
          }}
        >
          <label htmlFor={`${id}-date`}>受け取った日（未設定可）</label>
          <input
            id={`${id}-date`}
            name="receivedOn"
            type="date"
            max={japanToday()}
            value={receivedOn}
            disabled={saving}
            aria-describedby={fieldError ? `${id}-error` : undefined}
            aria-invalid={!!fieldError && !validReceiptDate(receivedOn)}
            onChange={(event) => {
              setDraft({ ...currentDraft, receivedOn: event.target.value });
              setFieldError("");
            }}
          />
          <label htmlFor={`${id}-memo`}>メモ（自分だけに表示）</label>
          <textarea
            id={`${id}-memo`}
            name="memo"
            rows={3}
            value={memo}
            disabled={saving}
            aria-describedby={`${id}-hint${fieldError ? ` ${id}-error` : ""}`}
            aria-invalid={!!fieldError && memoLength(memo) > 500}
            onChange={(event) => {
              setDraft({ ...currentDraft, memo: event.target.value });
              setFieldError("");
            }}
          />
          <p id={`${id}-hint`}>500文字まで（絵文字も1文字として数えます）</p>
          <button type="submit" disabled={saving}>
            記録を保存
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
          >
            受け取りを取り消す
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save({ cardId, receivedOn: null, memo: null })}
        >
          受け取った
        </button>
      )}
      <p role="status">{status}</p>
      {(error || fieldError || saveError) && (
        <p role="alert" id={`${id}-error`}>
          {error || fieldError || saveError}
        </p>
      )}
    </section>
  );
}
