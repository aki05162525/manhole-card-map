import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type FormEvent,
} from "react";
import { api, isApiError } from "../../features/account/account-api";
import { forgetSignedIn } from "../../shared/browser/signed-in";
import {
  addPasskey,
  cancelled,
  withReauth,
  type Profile,
} from "../../features/account/webauthn";
import { ConfirmDialog } from "./confirm-dialog";
import { DISPLAY_NAME_RULE, PASSKEY_LABEL_RULE, message } from "./messages";

type Passkey = {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
};
type Confirm =
  | { kind: "passkey"; passkey: Passkey }
  | { kind: "codes" }
  | { kind: "account" };

const date = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeZone: "Asia/Tokyo",
});
const passkeyPath = (id: string) => "/api/passkeys/" + encodeURIComponent(id);

export function Settings({
  onSignedOut,
  onRecovery,
  onCodes,
  onDeleted,
}: {
  onSignedOut(): void;
  onRecovery(): void;
  onCodes(codes: string[]): void;
  onDeleted(): void;
}) {
  const id = useId();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [nameError, setNameError] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [labelError, setLabelError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // Every action goes through here: a lost session returns to sign-in, a
  // cancelled passkey prompt leaves the page as it was.
  const run = async (action: () => Promise<void>) => {
    setError("");
    setStatus("");
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      if (isApiError(failure, 401)) {
        forgetSignedIn();
        onSignedOut();
      } else if (isApiError(failure, 403, "recovery_session")) onRecovery();
      else if (!cancelled(failure)) setError(message(failure));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const reload = async () => {
    const [me, list] = await Promise.all([
      api<Profile>("/api/me"),
      api<{ passkeys: Passkey[] }>("/api/passkeys"),
    ]);
    setProfile(me);
    setPasskeys(list.passkeys);
  };
  const load = useEffectEvent(() => void run(reload));
  useEffect(() => load(), []);

  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = String(
      new FormData(event.currentTarget).get("displayName"),
    );
    setNameError("");
    return run(async () => {
      try {
        setProfile(
          await api<Profile>("/api/me", {
            method: "PATCH",
            body: { displayName },
          }),
        );
        setStatus("表示名を変更しました。");
      } catch (failure) {
        if (!isApiError(failure, 400, "invalid_display_name")) throw failure;
        setNameError(DISPLAY_NAME_RULE);
      }
    });
  };
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
  const confirmed = () =>
    run(async () => {
      if (confirm?.kind === "passkey") {
        await withReauth(() =>
          api(passkeyPath(confirm.passkey.id), { method: "DELETE" }),
        );
        await reload();
        setStatus("パスキーを削除しました。");
      } else if (confirm?.kind === "codes") {
        const { recoveryCodes } = await withReauth(() =>
          api<{ recoveryCodes: string[] }>("/api/recovery-codes", {
            method: "POST",
          }),
        );
        onCodes(recoveryCodes);
      } else if (confirm?.kind === "account") {
        await withReauth(() => api("/api/me", { method: "DELETE" }));
        forgetSignedIn();
        onDeleted();
      }
    });
  const last = (passkeys?.length ?? 0) <= 1;

  return (
    <>
      <h1>アカウント</h1>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <p role="status" className="account-status">
        {status}
      </p>
      {profile && (
        <section className="account-section" aria-labelledby={id + "name"}>
          <h2 id={id + "name"}>表示名</h2>
          <form onSubmit={rename} className="account-form">
            <label htmlFor={id + "display"}>表示名</label>
            <input
              id={id + "display"}
              name="displayName"
              required
              defaultValue={profile.displayName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? id + "nameError" : undefined}
            />
            {nameError && (
              <p id={id + "nameError"} className="account-error">
                {nameError}
              </p>
            )}
            <div className="account-actions">
              <button type="submit" disabled={busy}>
                変更する
              </button>
            </div>
          </form>
        </section>
      )}
      {passkeys && (
        <section className="account-section" aria-labelledby={id + "keys"}>
          <h2 id={id + "keys"}>パスキー</h2>
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
                        onClick={() => setConfirm({ kind: "passkey", passkey })}
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
                  setStatus("パスキーを追加しました。");
                })
              }
            >
              パスキーを追加
            </button>
          </div>
        </section>
      )}
      {profile && (
        <section className="account-section" aria-labelledby={id + "codes"}>
          <h2 id={id + "codes"}>回復コード</h2>
          <p>残り {profile.recoveryCodesRemaining} 個</p>
          <div className="account-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm({ kind: "codes" })}
            >
              回復コードを再発行
            </button>
          </div>
        </section>
      )}
      <section className="account-section" aria-labelledby={id + "end"}>
        <h2 id={id + "end"}>ログアウト・削除</h2>
        <div className="account-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/api/auth/logout", { method: "POST" });
                forgetSignedIn();
                onSignedOut();
              })
            }
          >
            ログアウト
          </button>
          <button
            type="button"
            className="account-danger"
            disabled={busy}
            onClick={() => setConfirm({ kind: "account" })}
          >
            アカウントを削除
          </button>
        </div>
      </section>
      <ConfirmDialog
        open={confirm?.kind === "passkey"}
        title="パスキーを削除"
        confirm="削除する"
        busy={busy}
        onConfirm={confirmed}
        onClose={() => setConfirm(null)}
      >
        <p>
          {confirm?.kind === "passkey" && `「${confirm.passkey.label}」`}
          をこのアカウントから外します。端末やパスワード管理ツールに残ったパスキーは、そちらで削除してください。
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "codes"}
        title="回復コードを再発行"
        confirm="再発行する"
        busy={busy}
        onConfirm={confirmed}
        onClose={() => setConfirm(null)}
      >
        <p>新しい10個を発行し、今の回復コードはすべて使えなくなります。</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === "account"}
        title="アカウントを削除"
        confirm="削除する"
        busy={busy}
        onConfirm={confirmed}
        onClose={() => setConfirm(null)}
      >
        <p>次のものをすべて消します。元に戻せません。</p>
        <ul>
          <li>受け取り記録とメモ</li>
          <li>フレンド関係・申請・ブロック</li>
          <li>登録したパスキー</li>
          <li>回復コード</li>
        </ul>
        <p>
          障害に備えたバックアップには、削除後も最長30日残ります。端末やパスワード管理ツールに残ったパスキーは、そちらで削除してください。
        </p>
      </ConfirmDialog>
    </>
  );
}
