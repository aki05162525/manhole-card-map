import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type FormEvent,
} from "react";
import { isApiError, usePrivateApi } from "../../features/account/account-api";
import {
  amend,
  readPrivate,
  remembered,
} from "../../features/account/private-reads";
import { forgetSignedIn, signedIn } from "../../shared/browser/signed-in";
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

// The settings as one read: kept for a return (`private-reads.ts`).
const PAGE = "/api/account";
type Page = { profile: Profile; passkeys: Passkey[] };

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
  // What was read before for this user, drawn at once and read again.
  const [kept] = useState(() => remembered<Page>(PAGE));
  const [profile, setProfile] = useState(kept?.profile ?? null);
  const [passkeys, setPasskeys] = useState(kept?.passkeys ?? null);
  const { busy, error, run: start } = useAction();
  const [status, setStatus] = useState("");
  const [nameError, setNameError] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // Signed out or another user now: nothing of the one before stays.
  const session = usePrivateApi(() => {
    setProfile(null);
    setPasskeys(null);
    setConfirm(null);
    if (!signedIn()) onSignedOut();
    else void run(() => reload());
  });

  // Every action goes through here: a lost session returns to sign-in, a
  // cancelled passkey prompt leaves the page as it was.
  const run = (action: () => Promise<void>, background = false) => {
    setStatus("");
    return start(action, {
      background,
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
  // On entering, a read started ahead of the screen counts as this one.
  const reload = async ({ fresh = true } = {}) => {
    const page = await readPrivate<Page>(session, PAGE, { fresh });
    setProfile(page.profile);
    setPasskeys(page.passkeys);
  };
  // With the settings read before on screen, the read again stays behind.
  const load = useEffectEvent(
    () => void run(() => reload({ fresh: false }), kept !== null),
  );
  useEffect(() => load(), []);

  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = String(
      new FormData(event.currentTarget).get("displayName"),
    );
    setNameError("");
    return run(async () => {
      try {
        const renamed = await session.api<Profile>("/api/me", {
          method: "PATCH",
          body: { displayName },
        });
        setProfile(renamed);
        amend<Page>(PAGE, (page) => ({ ...page, profile: renamed }));
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
        await withReauth(session, () =>
          session.api(passkeyPath(confirm.passkey.id), { method: "DELETE" }),
        );
        await reload();
        setStatus("パスキーを削除しました。");
      } else if (confirm?.kind === "codes") {
        const codes = await reissueRecoveryCodes(session);
        // The count is kept; the codes themselves only on their screen.
        amend<Page>(PAGE, (page) => ({
          ...page,
          profile: { ...page.profile, recoveryCodesRemaining: codes.length },
        }));
        onCodes(codes);
      } else if (confirm?.kind === "account") {
        await withReauth(session, () =>
          session.api("/api/me", { method: "DELETE" }),
        );
        forgetSignedIn();
        onDeleted();
      }
    });

  return (
    <>
      <h1 tabIndex={-1}>アカウント</h1>
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
                // A fresh read of another name replaces the one drawn first.
                key={profile.displayName}
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
          session={session}
          busy={busy}
          run={run}
          reload={() => reload()}
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
                  await logout(session);
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
