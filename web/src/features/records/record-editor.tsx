import { useEffect, useId, useRef, useState } from "react";
import {
  japanToday,
  memoLength,
  validReceiptDate,
  type Receipt,
} from "../../domain/records";
import { recordErrorMessage, useRecords } from "./records-context";

type Detail = Receipt & { memo: string | null };
export function RecordEditor({ cardId }: { cardId: string }) {
  const { phase } = useRecords();
  return phase === "ready" ? <Editor key={cardId} cardId={cardId} /> : null;
}
function Editor({ cardId }: { cardId: string }) {
  const { request, update } = useRecords();
  const [record, setRecord] = useState<Detail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [receivedOn, setDate] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const alive = useRef(true);
  const id = useId();
  const path = `/api/me/records/${encodeURIComponent(cardId)}`;
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    setLoaded(false);
    setError("");
    void request(path)
      .then(async (response) => {
        const value: Detail | null =
          response.status === 404 ? null : await response.json();
        if (
          value &&
          (typeof value.cardId !== "string" ||
            !(value.memo === null || typeof value.memo === "string") ||
            !(
              value.receivedOn === null || typeof value.receivedOn === "string"
            ))
        )
          throw new Error("invalid record");
        if (cancelled) return;
        setRecord(value);
        setDate(value?.receivedOn ?? "");
        setMemo(value?.memo ?? "");
        // The detail response is newer than the summary (e.g. another tab edited it).
        update(cardId, value);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("記録を読み込めませんでした");
      });
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [path, cardId, request, update, attempt]);
  async function save(next: Detail | null) {
    if (pending.current) return;
    pending.current = true;
    const previous = record;
    setRecord(next);
    setDate(next?.receivedOn ?? "");
    setMemo(next?.memo ?? "");
    update(cardId, next);
    setStatus("保存中…");
    setError("");
    setFieldError("");
    try {
      const response = await request(
        path,
        next
          ? {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                receivedOn: next.receivedOn,
                memo: next.memo,
              }),
            }
          : { method: "DELETE" },
      );
      if (!response.ok) throw new Error(String(response.status));
      // PUT returns the date but deliberately omits the private memo.
      if (next) {
        const saved: Receipt = await response.json();
        if (!alive.current) return;
        const confirmed = { ...next, receivedOn: saved.receivedOn };
        setRecord(confirmed);
        setDate(confirmed.receivedOn ?? "");
        update(cardId, confirmed);
      }
      if (alive.current) setStatus(next ? "保存しました" : "取り消しました");
    } catch (cause) {
      update(cardId, previous);
      if (alive.current) {
        setRecord(previous);
        setDate(previous?.receivedOn ?? "");
        setMemo(previous?.memo ?? "");
        setStatus("");
        setError(recordErrorMessage(cause));
      }
    } finally {
      pending.current = false;
    }
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
  const saving = status === "保存中…";
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
              setDate(event.target.value);
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
              setMemo(event.target.value);
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
      {(error || fieldError) && (
        <p role="alert" id={`${id}-error`}>
          {error || fieldError}
        </p>
      )}
    </section>
  );
}
