import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { isApiError } from "../../session/api";
import {
  useOnUser,
  usePrivateApi,
  type Operation,
} from "../../session/account-api";
import type { Owner } from "../../session/session-guard";
import { amend, readPrivate, remembered } from "../../session/private-reads";
import { signalDisplayName, signalPasskeys } from "./passkey-signals";
import {
  accountRead,
  isPasskeyAccount,
  isProfile,
  type AccountPage,
  type Profile,
} from "../../contract/private-api";
import type { Seal } from "../../contract/seal";
import { SealForm } from "./seal-form";
import { signedIn } from "../../session/signed-in";
import { logout, reissueRecoveryCodes, withReauth } from "./webauthn";
import { DISPLAY_NAME_EMPTY, DISPLAY_NAME_RULE } from "./messages";
import { PasskeyList, passkeyPath } from "./passkey-list";
import { SettingsDialogs, type Confirm } from "./settings-dialogs";
import { emptyField, fieldText, useAction } from "./use-action";

export function Settings({
  onSignedOut,
  onRecovery,
  onCodes,
  onDeleted,
}: {
  onSignedOut(): void;
  /**
   * A request was refused as a recovery's session's: the guard has
   * forgotten the display cookies left, which are not a session's (and
   * the settings have closed as signed out).
   */
  onRecovery(): void;
  /** The codes reissued for the session `mark` names. */
  onCodes(codes: string[], mark: string | null): void;
  onDeleted(): void;
}) {
  const id = useId();
  const { busy, error, run: start } = useAction();
  const [status, setStatus] = useState("");
  const [nameError, setNameError] = useState("");
  const session = usePrivateApi();
  // The settings shown, and the owner they were read as: drawn only while
  // the screen still holds it (`shows`). What was read before for this
  // user is drawn at once and read again.
  const [kept] = useState(() => remembered(accountRead));
  const [account, setAccount] = useState<
    (AccountPage & { owner: Owner }) | null
  >(() => kept && { ...kept, owner: session.owner });
  // The dialog open, for the owner it was asked as: it names a passkey.
  const [confirm, setConfirm] = useState<(Confirm & { owner: Owner }) | null>(
    null,
  );
  const shown = account && session.shows(account.owner) ? account : null;
  const asked = confirm && session.shows(confirm.owner) ? confirm : null;
  // A dialog opened as the screen's owner, once the cookies still name it.
  const ask = (next: Confirm) => {
    const { owner } = session;
    if (session.holds(owner)) setConfirm({ ...next, owner });
  };

  // The actions begun so far: a read from before one may miss its change.
  const actions = useRef(0);
  // Every action goes through here, as one operation of the user signed in
  // as it begins: a lost session has returned to sign-in already (the
  // guard told the screen as it took the 401), and a cancelled passkey
  // prompt leaves the page as it was.
  const send = (
    action: (operation: Operation) => Promise<void>,
    background = false,
  ) => {
    if (!background) actions.current += 1;
    const operation = session.operation();
    return start(() => action(operation), {
      background,
      prompt: true,
      handle(failure) {
        if (isApiError(failure, 401)) return true;
        if (!isApiError(failure, 403, "recovery_session")) return false;
        onRecovery();
        return true;
      },
      settled: () => setConfirm(null),
    });
  };
  const run: typeof send = (action, background) => {
    setStatus("");
    return send(action, background);
  };
  // On entering, a read started ahead of the screen counts as this one.
  // Each read tells the passkey manager what it found: the passkeys left
  // after a deletion elsewhere, and the name, which the passkeys made
  // before they carried it take now. Never from what was kept in memory,
  // nor from a read behind the screen that an action has overtaken: the
  // manager may drop a passkey the list lacks, and that read may have
  // begun before the passkey was added.
  const reload = async (operation: Operation, { fresh = true } = {}) => {
    const begun = actions.current;
    const page = await readPrivate(operation, accountRead, { fresh });
    if (!session.holds(operation.owner)) return false;
    setAccount({ ...page, owner: operation.owner });
    if (begun !== actions.current) return true;
    signalPasskeys(
      page.profile,
      page.passkeys.map((passkey) => passkey.id),
    );
    signalDisplayName(page.profile, page.profile.displayName);
    return true;
  };
  // Signed out (a logout elsewhere, or a 401, which the guard has told
  // every screen of) or another user now: nothing of the one before stays.
  useOnUser(session, () => {
    setAccount(null);
    setConfirm(null);
    if (!signedIn()) onSignedOut();
    else
      void run(async (operation) => {
        await reload(operation);
      });
  });
  // With the settings read before on screen, the read again stays behind.
  // Nothing is said yet as the screen is entered: `send`, not `run`.
  const load = useEffectEvent(
    () =>
      void send(async (operation) => {
        await reload(operation, { fresh: false });
      }, kept !== null),
  );
  useEffect(() => load(), []);

  // The name or the seal, one at a time. `refused` takes the Worker's
  // refusal of the value itself, which is said beside its field.
  const update = (
    body: { displayName: string } | { seal: Seal },
    saved: (profile: Profile) => void,
    refused?: () => void,
  ) =>
    void run(async (operation) => {
      try {
        const profile = await operation.api("/api/me", {
          method: "PATCH",
          body,
          read: isProfile,
        });
        const { owner } = operation;
        if (
          !amend(session, owner, accountRead, (page) => ({ ...page, profile }))
        )
          return;
        setAccount((previous) =>
          previous && previous.owner === owner
            ? { ...previous, profile }
            : previous,
        );
        saved(profile);
      } catch (failure) {
        if (!refused || !isApiError(failure, 400, "invalid_display_name"))
          throw failure;
        refused();
      }
    });
  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emptyField(event.currentTarget, "displayName"))
      return setNameError(DISPLAY_NAME_EMPTY);
    const displayName = fieldText(event.currentTarget, "displayName");
    setNameError("");
    update(
      { displayName },
      (renamed) => {
        signalDisplayName(renamed, renamed.displayName);
        setStatus("表示名を変更しました。");
      },
      () => setNameError(DISPLAY_NAME_RULE),
    );
  };
  const confirmed = () => {
    if (!confirm || !session.holds(confirm.owner)) return;
    void run(async (operation) => {
      if (confirm.kind === "passkey") {
        await withReauth(operation, () =>
          operation.api(passkeyPath(confirm.passkey.id), { method: "DELETE" }),
        );
        if (await reload(operation)) setStatus("パスキーを削除しました。");
      } else if (confirm.kind === "codes") {
        // The codes go to their screen only while this one still holds the
        // owner the reissue was taken for; that screen draws them only
        // while the cookies name its session (`RecoveryCodes`).
        const { codes, owner } = await reissueRecoveryCodes(operation);
        // The count is kept; the codes themselves only on their screen.
        if (
          amend(session, owner, accountRead, (page) => ({
            ...page,
            profile: { ...page.profile, recoveryCodesRemaining: codes.length },
          }))
        )
          onCodes(codes, owner.mark);
      } else {
        const deleted = await withReauth(operation, () =>
          operation.api("/api/me", {
            method: "DELETE",
            change: "end",
            read: isPasskeyAccount,
          }),
        );
        // No passkey of the account works any more. The guard has told
        // every screen of the end as it took the answer.
        signalPasskeys(deleted, []);
        onDeleted();
      }
    });
  };

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
      {shown && (
        <section
          className="account-section account-row"
          aria-labelledby={id + "name"}
        >
          <h2 id={id + "name"}>プロフィール</h2>
          <div>
            <form onSubmit={rename} className="account-form" noValidate>
              <label htmlFor={id + "display"}>表示名</label>
              <div className="account-inline">
                <input
                  // A fresh read of another name replaces the one drawn first.
                  key={shown.profile.displayName}
                  id={id + "display"}
                  name="displayName"
                  required
                  defaultValue={shown.profile.displayName}
                  onChange={() => setNameError("")}
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
            <SealForm
              // Another saved seal replaces the choices made on the one before.
              key={JSON.stringify(shown.profile.seal)}
              seal={shown.profile.seal}
              name={shown.profile.displayName}
              busy={busy}
              onSubmit={(seal) =>
                update({ seal }, () => setStatus("印を変更しました。"))
              }
            />
          </div>
        </section>
      )}
      {shown && (
        <PasskeyList
          passkeys={shown.passkeys}
          shows={() => session.shows(shown.owner)}
          holds={() => session.holds(shown.owner)}
          busy={busy}
          run={run}
          reload={reload}
          onStatus={setStatus}
          onDelete={(passkey) => ask({ kind: "passkey", passkey })}
        />
      )}
      {shown && (
        <section
          className="account-section account-row"
          aria-labelledby={id + "codes"}
        >
          <h2 id={id + "codes"}>回復コード</h2>
          <div>
            <p>
              残り{" "}
              <span className="account-count">
                {shown.profile.recoveryCodesRemaining}
              </span>{" "}
              個
            </p>
            <div className="account-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => ask({ kind: "codes" })}
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
                void run(async (operation) => {
                  // The guard has told every screen of the end as it took
                  // the answer.
                  await logout(operation);
                  onSignedOut();
                })
              }
            >
              ログアウト
            </button>
          </div>
          <div className="account-danger-zone">
            <p className="account-hint">
              アカウントを削除すると、入手の記録、フレンド、パスキー、回復コードがすべて削除されます。この操作は取り消せません。
            </p>
            <div className="account-actions">
              <button
                type="button"
                className="account-danger"
                disabled={busy}
                onClick={() => ask({ kind: "account" })}
              >
                アカウントを削除
              </button>
            </div>
          </div>
        </div>
      </section>
      <SettingsDialogs
        confirm={asked}
        busy={busy}
        onConfirm={confirmed}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
