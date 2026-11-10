import { useId, useState } from "react";

const FILE_NAME = "manhole-techo-recovery-codes.txt";

// Shown once after registration or reissue; the codes are never fetched
// again, so the user must confirm keeping them before leaving (AC-2).
export function RecoveryCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone(): void;
}) {
  const id = useId();
  const [kept, setKept] = useState(false);
  const [status, setStatus] = useState("");
  const text =
    "マンホール手帳 回復コード\n" +
    "パスキーを失ったときに1つずつ使えます。使ったコードは無効になります。\n\n" +
    codes.join("\n") +
    "\n";
  const copy = async () => {
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
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
    setStatus(`${FILE_NAME} を保存しました。`);
  };
  return (
    <section className="account-section" aria-labelledby={id + "h"}>
      <h1 id={id + "h"}>回復コード</h1>
      <p>
        パスキーを使えなくなったときに、このコードで入り直せます。この画面を閉じると二度と表示できません。端末の外（紙やパスワード管理ツールなど）に控えてください。
      </p>
      <ol className="recovery-code-list" aria-label="回復コード">
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
    </section>
  );
}
