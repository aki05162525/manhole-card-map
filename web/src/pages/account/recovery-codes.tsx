import { TriangleAlert } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { DORMANT_MS } from "../../shared/browser/session-guard";
import {
  onPageReturn,
  sessionMark,
  signedIn,
} from "../../shared/browser/signed-in";

const FILE_NAME = "manhole-techo-recovery-codes.txt";

// Shown once after registration or reissue; the codes are never fetched
// again, so the user must confirm keeping them before leaving (AC-2). They
// are the codes of the session `mark` names, and drawn only while the
// cookies name it: another tab's logout or sign-in closes them (`onLost`).
// An hour after they were shown (`DORMANT_MS`), the session may have ended
// on the Worker's side alone: they are discarded (`onDiscard`), not checked
// and shown again, as a value shown once should not come back. Both are
// decided before each draw, so the codes never reach the page otherwise.
export function RecoveryCodes({
  codes,
  mark,
  onDone,
  onLost,
  onDiscard,
}: {
  codes: string[];
  mark: string | null;
  onDone(): void;
  onLost(): void;
  onDiscard(): void;
}) {
  const id = useId();
  const [shownAt] = useState(Date.now);
  const state = () =>
    !signedIn() || sessionMark() !== mark
      ? "lost"
      : Date.now() - shownAt >= DORMANT_MS
        ? "discarded"
        : "shown";
  const ended = useRef(false);
  // Whether the codes may stay; once not, either switches screens (once),
  // which checks the session again.
  const settle = () => {
    const now = state();
    if (now === "shown") return true;
    if (!ended.current) {
      ended.current = true;
      if (now === "lost") onLost();
      else onDiscard();
    }
    return false;
  };
  const check = useEffectEvent(settle);
  useEffect(() => {
    check();
    const stop = onPageReturn(() => check());
    // Left open on screen as long, they go as well.
    const timer = setTimeout(() => check(), shownAt + DORMANT_MS - Date.now());
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [shownAt]);
  const [kept, setKept] = useState(false);
  const [status, setStatus] = useState("");
  const text =
    "マンホール手帳 回復コード\n" +
    "パスキーを失ったときに1つずつ使えます。使ったコードは無効になります。\n\n" +
    codes.join("\n") +
    "\n";
  const copy = async () => {
    if (!settle()) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setStatus("コピーしました。");
    } catch {
      setStatus(
        "コピーできませんでした。ファイルに保存するか書き写してください。",
      );
    }
  };
  const save = () => {
    if (!settle()) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
    setStatus(`${FILE_NAME} を保存しました。`);
  };
  if (state() !== "shown") return null;
  return (
    <>
      <h1 id={id + "h"} tabIndex={-1}>
        回復コード
      </h1>
      <p className="account-lead">
        パスキーを使えなくなったときに、このコードで入り直せます。この画面を閉じると二度と表示できません。端末の外（紙やパスワード管理ツールなど）に控えてください。
      </p>
      <p className="account-warning">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>
          パスキーと回復コードを両方失うと、アカウントを復旧できません。
        </span>
      </p>
      <div className="recovery-sheet">
        <ol
          className="recovery-code-list"
          // Safari drops the list role of list-style: none lists.
          // oxlint-disable-next-line jsx-a11y/no-redundant-roles
          role="list"
          aria-labelledby={id + "h"}
        >
          {codes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ol>
        <div className="account-actions">
          <button type="button" onClick={copy}>
            コピー
          </button>
          <button type="button" onClick={save}>
            ファイルに保存
          </button>
        </div>
        <p role="status" className="account-status">
          {status}
        </p>
      </div>
      <label className="account-check">
        <input
          type="checkbox"
          checked={kept}
          onChange={(event) => setKept(event.currentTarget.checked)}
        />
        回復コードを控えました
      </label>
      <div className="account-actions">
        <button
          type="button"
          className="account-primary"
          disabled={!kept}
          onClick={onDone}
        >
          次へ
        </button>
      </div>
    </>
  );
}

/** The codes went unconfirmed for an hour on screen (`RecoveryCodes`). */
export function CodesDiscarded({ onNext }: { onNext(): void }) {
  return (
    <>
      <h1 tabIndex={-1}>回復コードを閉じました</h1>
      <p className="account-lead">
        表示してから1時間が過ぎたため、回復コードを画面から消しました。控えていない場合は、アカウントの画面で回復コードを再発行してください。
      </p>
      <div className="account-actions">
        <button type="button" className="account-primary" onClick={onNext}>
          アカウントの画面へ
        </button>
      </div>
    </>
  );
}
