import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { japanToday, memoLength, validReceiptDate } from "../../domain/records";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { Delayed } from "../../shared/ui/delayed";
import { emptyDetail, useRecords } from "./records-context";

function ReceivedDate({ value }: { value: string | null }) {
  if (!value) return <span className="record-unset">未設定</span>;
  const [year, month, day] = value.split("-").map(Number);
  return (
    <time dateTime={value}>
      {year}年{month}月{day}日
    </time>
  );
}
function RecordState({ done, status }: { done: boolean; status?: string }) {
  return (
    <div className="record-state">
      <span className="record-mark" aria-hidden="true">
        {done && <Check size={16} strokeWidth={3} />}
      </span>
      <p className="record-state-label">{done ? "回収済み" : "未回収"}</p>
      {status !== undefined && (
        <p className="record-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
function RecordError({ id, children }: { id?: string; children: string }) {
  return (
    <p className="record-error ui-error" id={id} role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function RecordEditor({ cardId }: { cardId: string }) {
  const { phase, friendName, records } = useRecords();
  if (friendName !== undefined) {
    if (phase !== "ready") return null;
    const receipt = records?.get(cardId);
    const title = `${friendName}さんの回収記録`;
    return (
      <section
        className="record-editor"
        aria-label={title}
        data-state={receipt ? "done" : "none"}
      >
        <h3 className="record-title">{title}</h3>
        <RecordState done={Boolean(receipt)} />
        {receipt && (
          <dl className="record-facts">
            <div>
              <dt>回収した日</dt>
              <dd>
                <ReceivedDate value={receipt.receivedOn} />
              </dd>
            </div>
          </dl>
        )}
      </section>
    );
  }
  return phase === "ready" ? <Editor key={cardId} cardId={cardId} /> : null;
}
function Editor({ cardId }: { cardId: string }) {
  const { details, records, load, save: saveRecord } = useRecords();
  const detail = details.get(cardId) ?? emptyDetail;
  const {
    loaded,
    pending: saving,
    status,
    loadError: error,
    saveError,
  } = detail;
  // Until the read answers, the summary already tells whether and when the
  // card was received; only the memo waits. A card the summary lacks shows as
  // unreceived at once, and the read still corrects a summary another tab
  // has made stale.
  const receipt = records?.get(cardId);
  const record = loaded
    ? detail.record
    : receipt
      ? { ...receipt, memo: null }
      : null;
  // The form and the undo depend on the memo, so they wait for it too.
  const memoPending = !loaded && record !== null;
  const busy = saving || memoPending;
  const [editing, setEditing] = useState(false);
  // A failed edit reopens the form with what was typed instead of losing it.
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState({ receivedOn: "", memo: "" });
  const [fieldError, setFieldError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const section = useRef<HTMLElement>(null);
  const path = `/api/me/records/${encodeURIComponent(cardId)}`;
  useEffect(() => {
    void load(cardId);
  }, [cardId, load, attempt]);
  const formOpen =
    record !== null && (editing || (submitted && !saving && saveError !== ""));
  // A failed save reopens the form and removes the focused edit button; put
  // focus back in the form unless the user has already moved elsewhere.
  const reopened = formOpen && !editing;
  const wasReopened = useRef(false);
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (
      reopened &&
      !wasReopened.current &&
      (!active || active === document.body)
    )
      section.current?.querySelector<HTMLElement>("input")?.focus();
    wasReopened.current = reopened;
  }, [reopened]);
  function save(next: typeof record) {
    setFieldError("");
    if (!saving) void saveRecord(cardId, next);
  }
  // The pressed button disappears, so focus moves to the control that replaces it.
  function updateAndFocus(update: () => void, selector: string) {
    flushSync(update);
    section.current?.querySelector<HTMLElement>(selector)?.focus();
  }
  function undo() {
    updateAndFocus(() => {
      setConfirming(false);
      save(null);
    }, ".record-receive");
  }
  const { receivedOn, memo } = draft;
  const failure = error || saveError;
  return (
    <section
      ref={section}
      className="record-editor ui-controls"
      aria-label="回収の記録"
      aria-busy={saving || undefined}
      data-state={record ? "done" : "none"}
      data-fresh={status ? "" : undefined}
    >
      <h3 className="record-title">回収の記録</h3>
      <RecordState done={record !== null} status={status} />
      {memoPending && !error && (
        <Delayed>
          <p className="record-loading" role="status">
            記録を読み込み中…
          </p>
        </Delayed>
      )}
      {failure && <RecordError>{failure}</RecordError>}
      {error && !loaded && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          記録を再読み込み
        </button>
      )}
      {!record ? (
        <button
          type="button"
          className="record-receive"
          aria-disabled={saving || undefined}
          onClick={() => {
            if (saving) return;
            updateAndFocus(
              () => save({ cardId, receivedOn: japanToday(), memo: null }),
              ".record-edit",
            );
          }}
        >
          <Check size={18} aria-hidden="true" />
          回収した
        </button>
      ) : formOpen ? (
        <form
          className="record-form"
          action={path}
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = !validReceiptDate(receivedOn)
              ? "回収した日は今日以前の日付にしてください。"
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
            updateAndFocus(() => {
              setEditing(false);
              setSubmitted(true);
              save({
                cardId,
                receivedOn: receivedOn || null,
                memo: memo || null,
              });
            }, ".record-edit");
          }}
        >
          <div className="record-field">
            <label htmlFor={`${id}-date`}>回収した日（任意）</label>
            <div className="record-date-row">
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
                  setDraft({ ...draft, receivedOn: event.target.value });
                  setFieldError("");
                }}
              />
              <button
                type="button"
                className="record-today"
                disabled={saving}
                onClick={() => {
                  setDraft({ ...draft, receivedOn: japanToday() });
                  setFieldError("");
                }}
              >
                今日
              </button>
            </div>
          </div>
          <div className="record-field">
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
                setDraft({ ...draft, memo: event.target.value });
                setFieldError("");
              }}
            />
            <p id={`${id}-hint`} className="record-hint">
              {memoLength(memo)} / 500文字
            </p>
          </div>
          {fieldError && (
            <RecordError id={`${id}-error`}>{fieldError}</RecordError>
          )}
          <div className="record-actions">
            <button
              type="submit"
              className="record-save ui-primary"
              disabled={saving}
            >
              保存する
            </button>
            <button
              type="button"
              className="record-cancel"
              onClick={() =>
                updateAndFocus(() => {
                  setEditing(false);
                  setSubmitted(false);
                  setFieldError("");
                }, ".record-edit")
              }
            >
              やめる
            </button>
          </div>
        </form>
      ) : (
        <>
          {(record.receivedOn || record.memo) && (
            <dl className="record-facts">
              <div>
                <dt>回収した日</dt>
                <dd>
                  <ReceivedDate value={record.receivedOn} />
                </dd>
              </div>
              <div>
                <dt>メモ</dt>
                <dd>
                  {record.memo || <span className="record-unset">なし</span>}
                </dd>
              </div>
            </dl>
          )}
          <div className="record-actions">
            <button
              type="button"
              className="record-edit"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (busy) return;
                updateAndFocus(() => {
                  setDraft({
                    receivedOn: record.receivedOn ?? "",
                    memo: record.memo ?? "",
                  });
                  setEditing(true);
                  setSubmitted(false);
                }, "input");
              }}
            >
              日付・メモを編集
            </button>
            <button
              type="button"
              className="record-undo"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (busy) return;
                if (record.memo) setConfirming(true);
                else undo();
              }}
            >
              未回収に戻す
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="未回収に戻す"
        confirm="未回収に戻す"
        busy={saving}
        onConfirm={undo}
        onClose={() => setConfirming(false)}
      >
        <p>回収した日とメモも消えます。消したメモは元に戻せません。</p>
      </ConfirmDialog>
    </section>
  );
}
