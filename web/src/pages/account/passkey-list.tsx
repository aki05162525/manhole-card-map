import { useId, useState, type FormEvent } from "react";
import { api, isApiError } from "../../features/account/account-api";
import { addPasskey } from "../../features/account/webauthn";
import { japanFormat } from "../../shared/universal/japan-time";
import { PASSKEY_LABEL_RULE } from "./messages";

export type Passkey = {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
};

const date = /* @__PURE__ */ japanFormat({ dateStyle: "medium" });
export const passkeyPath = (id: string) =>
  "/api/passkeys/" + encodeURIComponent(id);

// The passkeys of the account: rename in place, add, and ask to delete.
export function PasskeyList({
  passkeys,
  busy,
  run,
  reload,
  onStatus,
  onDelete,
}: {
  passkeys: Passkey[];
  busy: boolean;
  run(action: () => Promise<void>): Promise<void>;
  reload(): Promise<void>;
  onStatus(status: string): void;
  onDelete(passkey: Passkey): void;
}) {
  const id = useId();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [labelError, setLabelError] = useState("");
  const relabel = (passkey: Passkey, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label"));
    setLabelError("");
    return run(async () => {
      try {
        await api(passkeyPath(passkey.id), {
          method: "PATCH",
          body: { label },
        });
        setRenaming(null);
        await reload();
      } catch (failure) {
        if (!isApiError(failure, 400, "invalid_label")) throw failure;
        setLabelError(PASSKEY_LABEL_RULE);
      }
    });
  };
  const last = passkeys.length <= 1;

  return (
    <section
      className="account-section account-row"
      aria-labelledby={id + "keys"}
    >
      <h2 id={id + "keys"}>パスキー</h2>
      <div>
        <ul className="passkey-list" aria-labelledby={id + "keys"}>
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              {renaming === passkey.id ? (
                <form
                  className="account-form"
                  onSubmit={(event) => relabel(passkey, event)}
                >
                  <label htmlFor={id + passkey.id}>パスキーの名前</label>
                  <input
                    id={id + passkey.id}
                    name="label"
                    required
                    defaultValue={passkey.label}
                    aria-invalid={labelError ? true : undefined}
                    aria-describedby={
                      labelError ? id + "labelError" : undefined
                    }
                  />
                  {labelError && (
                    <p id={id + "labelError"} className="account-error">
                      {labelError}
                    </p>
                  )}
                  <div className="account-actions">
                    <button type="submit" disabled={busy}>
                      保存
                    </button>
                    <button type="button" onClick={() => setRenaming(null)}>
                      やめる
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <strong>{passkey.label}</strong>
                  <span className="passkey-dates">
                    登録 {date.format(passkey.createdAt)}・
                    {passkey.lastUsedAt === null
                      ? "未使用"
                      : "最後の使用 " + date.format(passkey.lastUsedAt)}
                  </span>
                  <div className="account-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setLabelError("");
                        setRenaming(passkey.id);
                      }}
                    >
                      名前を変更
                    </button>
                    <button
                      type="button"
                      disabled={busy || last}
                      onClick={() => onDelete(passkey)}
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {last && (
          <p className="account-hint">
            最後の1本は削除できません。先に別のパスキーを追加してください。
          </p>
        )}
        <div className="account-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await addPasskey();
                await reload();
                onStatus("パスキーを追加しました。");
              })
            }
          >
            パスキーを追加
          </button>
        </div>
      </div>
    </section>
  );
}
