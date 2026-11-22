import { detailTarget, detailSelector } from "../../shared/ui/detail-target";
import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { isReceiptDate, memoMax, memoTooLong } from "../../contract/records";
import { graphemeCount } from "../../contract/text";
import { japanToday } from "../../domain/records";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { Delayed } from "../../shared/ui/delayed";
import type { Owner } from "../../session/session-guard";
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
function RecordState({ done, status }: { done: boolean; status: string }) {
  return (
    <div className="record-state">
      <span className="record-mark" aria-hidden="true">
        {done && "済"}
      </span>
      <p className="record-state-label">{done ? "入手済み" : "未入手"}</p>
      <p className="record-status" role="status">
        {status}
      </p>
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

export function RecordEditor({
  cardId,
  collapsed,
  focusRequest,
  onUnreceived,
}: {
  cardId: string;
  collapsed?: boolean;
  focusRequest?: number | undefined;
  onUnreceived?: (() => void) | undefined;
}) {
  const { phase, friendName } = useRecords();
  if (friendName !== undefined) return null;
  return phase === "ready" ? (
    <Editor
      key={cardId}
      cardId={cardId}
      collapsed={collapsed}
      focusRequest={focusRequest}
      onUnreceived={onUnreceived}
    />
  ) : null;
}
function Editor({
  cardId,
  collapsed,
  focusRequest,
  onUnreceived,
}: {
  cardId: string;
  collapsed: boolean | undefined;
  focusRequest: number | undefined;
  onUnreceived: (() => void) | undefined;
}) {
  const {
    phase,
    owner,
    owns,
    details,
    records,
    load,
    save: saveRecord,
    view,
  } = useRecords();
  // Drawn on its own once the cookies name another user (a press), the
  // editor is handed the records loading (`useRecords`): it draws nothing
  // until its provider starts them again for that user.
  const shown = phase === "ready";
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
  // A later stamp press should only record, not reopen the previous editor.
  const unreceived = shown && record === null;
  useEffect(() => {
    if (unreceived) onUnreceived?.();
  }, [unreceived, onUnreceived]);
  // The form and the undo depend on the memo, so they wait for it too.
  const memoPending = !loaded && record !== null;
  const busy = saving || memoPending;
  // The read failed: whether the card has a record elsewhere is unknown, so
  // it offers no receipt until reloaded.
  const unread = error !== "" && !loaded;
  const [editing, setEditing] = useState(false);
  // A failed edit reopens the form with what was typed instead of losing it.
  const [submitted, setSubmitted] = useState(false);
  // What the form holds, copied from the record of the owner it was read
  // as: drawn only while that owner may still be (`owns`), as the record is.
  const [draft, setDraft] = useState<{
    receivedOn: string;
    memo: string;
    owner: Owner | null;
  }>({ receivedOn: "", memo: "", owner: null });
  const [fieldError, setFieldError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const section = useRef<HTMLElement>(null);
  const path = `/api/me/records/${encodeURIComponent(cardId)}`;
  useEffect(() => {
    void load(cardId);
  }, [cardId, load, attempt]);
  // Open until it unmounts: a receipt held for the read goes with it.
  useEffect(() => view(cardId), [cardId, view]);
  const formOpen =
    record !== null &&
    draft.owner !== null &&
    owns(draft.owner) &&
    (editing || (submitted && !saving && saveError !== ""));
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
  useLayoutEffect(() => {
    if (collapsed === false)
      section.current
        ?.querySelector<HTMLElement>(detailSelector("record"))
        ?.focus();
  }, [collapsed, focusRequest]);
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
    if (collapsed !== undefined)
      section.current
        ?.closest(".card-detail-content")
        ?.querySelector<HTMLButtonElement>("button.record-stamp")
        ?.focus();
  }
  const { receivedOn, memo } = draft;
  const today = japanToday();
  // An empty date field saves the record without a date.
  const dateInvalid = receivedOn !== "" && !isReceiptDate(receivedOn, today);
  const memoInvalid = memoTooLong(memo);
  const failure = error || saveError;
  if (!shown) return null;
  return (
    <section
      ref={section}
      tabIndex={-1}
      hidden={
        collapsed !== undefined &&
        (collapsed || !record) &&
        !error &&
        !saveError
      }
      className="record-editor ui-controls"
      aria-label="入手の記録"
      aria-busy={saving || undefined}
      data-state={record ? "done" : "none"}
      data-fresh={status ? "" : undefined}
    >
      <h3 {...detailTarget("record")} className="record-title" tabIndex={-1}>
        入手の記録
      </h3>
      <RecordState done={record !== null} status={status} />
      {memoPending && !error && (
        <Delayed>
          <p className="record-loading" role="status">
            記録を読み込み中…
          </p>
        </Delayed>
      )}
      {failure && <RecordError>{failure}</RecordError>}
      {unread && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          記録を再読み込み
        </button>
      )}
      {!record ? (
        collapsed === undefined &&
        !unread && (
          <button
            type="button"
            className="record-receive"
            aria-disabled={saving || undefined}
            // While saving, `save` sends nothing and nothing takes the focus.
            onClick={() =>
              updateAndFocus(
                () => save({ cardId, receivedOn: japanToday(), memo: null }),
                ".record-edit",
              )
            }
          >
            <Check size={18} aria-hidden="true" />
            入手した
          </button>
        )
      ) : formOpen ? (
        <form
          className="record-form"
          action={path}
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = dateInvalid
              ? "入手した日は今日以前の日付にしてください。"
              : memoInvalid
                ? `メモは${memoMax}文字以内にしてください。`
                : "";
            setFieldError(invalid);
            if (invalid) {
              event.currentTarget
                .querySelector<HTMLElement>(dateInvalid ? "input" : "textarea")
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
            <label htmlFor={`${id}-date`}>入手した日（任意）</label>
            <div className="record-date-row">
              <input
                id={`${id}-date`}
                name="receivedOn"
                type="date"
                max={today}
                value={receivedOn}
                disabled={saving}
                aria-describedby={fieldError ? `${id}-error` : undefined}
                aria-invalid={!!fieldError && dateInvalid}
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
              aria-invalid={!!fieldError && memoInvalid}
              onChange={(event) => {
                setDraft({ ...draft, memo: event.target.value });
                setFieldError("");
              }}
            />
            <p id={`${id}-hint`} className="record-hint">
              {graphemeCount(memo)} / {memoMax}文字
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
                <dt>入手した日</dt>
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
                // Copied as the owner the record was drawn for: pressed
                // once the cookies name another, the editor draws again
                // with nothing of theirs, and the form never shows it.
                updateAndFocus(() => {
                  setDraft({
                    receivedOn: record.receivedOn ?? "",
                    memo: record.memo ?? "",
                    owner,
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
              未入手に戻す
            </button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="未入手に戻す"
        confirm="未入手に戻す"
        busy={saving}
        onConfirm={undo}
        onClose={() => setConfirming(false)}
      >
        <p>入手した日とメモも消えます。消したメモは元に戻せません。</p>
      </ConfirmDialog>
    </section>
  );
}
