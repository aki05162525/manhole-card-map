import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type FormEvent,
} from "react";
import { ChevronRight } from "lucide-react";
import { api, isApiError } from "../../features/account/account-api";
import { forgetSignedIn } from "../../shared/browser/signed-in";
import {
  logout,
  reissueRecoveryCodes,
  withReauth,
  type Profile,
} from "../../features/account/webauthn";
import { DISPLAY_NAME_RULE } from "./messages";
import { PasskeyList, passkeyPath, type Passkey } from "./passkey-list";
import { SettingsDialogs, type Confirm } from "./settings-dialogs";
import { useAction } from "./use-action";

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
  const { busy, error, run: start } = useAction();
  const [status, setStatus] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // Every action goes through here: a lost session returns to sign-in, a
  // cancelled passkey prompt leaves the page as it was.
  const run = (action: () => Promise<void>) => {
    setStatus("");
    return start(action, {
      prompt: true,
      handle(failure) {
        if (isApiError(failure, 401)) {
          forgetSignedIn();
          onSignedOut();
        } else if (isApiError(failure, 403, "recovery_session")) onRecovery();
        else return false;
        return true;
      },
      settled: () => setConfirm(null),
    });
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
  const confirmed = () =>
    run(async () => {
      if (confirm?.kind === "passkey") {
        await withReauth(() =>
          api(passkeyPath(confirm.passkey.id), { method: "DELETE" }),
        );
        await reload();
        setStatus("パスキーを削除しました。");
      } else if (confirm?.kind === "codes") {
        onCodes(await reissueRecoveryCodes());
      } else if (confirm?.kind === "account") {
        await withReauth(() => api("/api/me", { method: "DELETE" }));
        forgetSignedIn();
        onDeleted();
      }
    });

  return (
    <>
      <h1 tabIndex={-1}>アカウント</h1>
      <p>
        <a className="account-nav-link" href="/friends">
          <span>フレンド</span>
          <small>招待・申請・一覧</small>
          <ChevronRight size={20} aria-hidden="true" />
        </a>
      </p>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <p role="status" className="account-status">
        {status}
      </p>
      {profile && (
        <section
          className="account-section account-row"
          aria-labelledby={id + "name"}
        >
          <h2 id={id + "name"}>プロフィール</h2>
          <form onSubmit={rename} className="account-form">
            <label htmlFor={id + "display"}>表示名</label>
            <div className="account-inline">
              <input
                id={id + "display"}
                name="displayName"
                required
                defaultValue={profile.displayName}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={id + (nameError ? "nameError" : "nameHint")}
              />
              <button type="submit" disabled={busy}>
                変更する
              </button>
            </div>
            {nameError ? (
              <p id={id + "nameError"} className="account-error">
                {nameError}
              </p>
            ) : (
              <p id={id + "nameHint"} className="account-hint">
                フレンドに表示します。
              </p>
            )}
          </form>
        </section>
      )}
      {passkeys && (
        <PasskeyList
          passkeys={passkeys}
          busy={busy}
          run={run}
          reload={reload}
          onStatus={setStatus}
          onDelete={(passkey) => setConfirm({ kind: "passkey", passkey })}
        />
      )}
      {profile && (
        <section
          className="account-section account-row"
          aria-labelledby={id + "codes"}
        >
          <h2 id={id + "codes"}>回復コード</h2>
          <div>
            <p>
              残り{" "}
              <span className="account-count">
                {profile.recoveryCodesRemaining}
              </span>{" "}
              個
            </p>
            <div className="account-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm({ kind: "codes" })}
              >
                回復コードを再発行
              </button>
            </div>
          </div>
        </section>
      )}
      <section
        className="account-section account-row"
        aria-labelledby={id + "end"}
      >
        <h2 id={id + "end"}>ログアウト・削除</h2>
        <div>
          <div className="account-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await logout();
                  forgetSignedIn();
                  onSignedOut();
                })
              }
            >
              ログアウト
            </button>
          </div>
          <div className="account-danger-zone">
            <p className="account-hint">
              アカウントを削除すると、回収の記録、フレンド、パスキー、回復コードをすべて消します。元に戻せません。
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="account-danger"
                disabled={busy}
                onClick={() => setConfirm({ kind: "account" })}
              >
                アカウントを削除
              </button>
            </div>
          </div>
        </div>
      </section>
      <SettingsDialogs
        confirm={confirm}
        busy={busy}
        onConfirm={confirmed}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
