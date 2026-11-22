import { useId, useState, type FormEvent } from "react";
import { isApiError } from "../../session/api";
import type { Operation } from "../../session/account-api";
import { addPasskey } from "./webauthn";
import { japanFormat } from "../../contract/japan-time";
import { PASSKEY_LABEL_EMPTY, PASSKEY_LABEL_RULE } from "./messages";
import type { Passkey } from "../../contract/private-api";
import { emptyField, fieldText } from "./use-action";

const date = /* @__PURE__ */ japanFormat({ dateStyle: "medium" });
export const passkeyPath = (id: string) =>
  "/api/passkeys/" + encodeURIComponent(id);

// The passkeys of the account: rename in place, add, and ask to delete.
export function PasskeyList({
  passkeys,
  shows,
  holds,
  busy,
  run,
  reload,
  onStatus,
  onDelete,
}: {
  passkeys: Passkey[];
  /**
   * Whether the passkeys are still the screen's owner's, to draw them: no
   * side effect. Asked in each render of the list, its own included.
   */
  shows(): boolean;
  /** The same, as a press acts on them: once not, the screen starts again. */
  holds(): boolean;
  busy: boolean;
  /** Runs `action` as one operation of the settings' user. */
  run(action: (operation: Operation) => Promise<void>): Promise<void>;
  /** Reads the settings again: false if they are another user's by then. */
  reload(operation: Operation): Promise<boolean>;
  onStatus(status: string): void;
  onDelete(passkey: Passkey): void;
}) {
  const id = useId();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [labelError, setLabelError] = useState("");
  const relabel = (passkey: Passkey, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emptyField(event.currentTarget, "label"))
      return setLabelError(PASSKEY_LABEL_EMPTY);
    const label = fieldText(event.currentTarget, "label");
    setLabelError("");
    void run(async (operation) => {
      try {
        await operation.api(passkeyPath(passkey.id), {
          method: "PATCH",
          body: { label },
        });
        setRenaming(null);
        await reload(operation);
      } catch (failure) {
        if (!isApiError(failure, 400, "invalid_label")) throw failure;
        setLabelError(PASSKEY_LABEL_RULE);
      }
    });
  };
  // Another user's by now (this page has not heard of it yet).
  if (!shows()) return null;
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
                  noValidate
                >
                  <label htmlFor={id + passkey.id}>パスキーの名前</label>
                  <input
                    id={id + passkey.id}
                    name="label"
                    required
                    defaultValue={passkey.label}
                    onChange={() => setLabelError("")}
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
                      : "最終利用 " + date.format(passkey.lastUsedAt)}
                  </span>
                  <div className="account-actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (!holds()) return;
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
              void run(async (operation) => {
                await addPasskey(operation);
                if (await reload(operation))
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
