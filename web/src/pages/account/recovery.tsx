import { useId, useState, type FormEvent } from "react";
import {
  api,
  isApiError,
  usePrivateApi,
} from "../../features/account/account-api";
import {
  addPasskey,
  logout,
  passkeysSupported,
  reissueRecoveryCodes,
} from "../../features/account/webauthn";
import { Unsupported } from "./sign-in";
import { emptyField, useAction } from "./use-action";

const RECOVERING = "account-recovering";

/**
 * The recovery this tab is in, by its `recoveryMark`, or null: kept only to
 * resume its step after a reload, while `recovery_mark` still names it.
 * `null` forgets it. sessionStorage may throw (blocked storage).
 */
export function tabRecovery(value?: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(RECOVERING);
    else if (value !== undefined) sessionStorage.setItem(RECOVERING, value);
    return sessionStorage.getItem(RECOVERING);
  } catch {
    return null;
  }
}

export function RecoverForm({
  onRecovered,
  onBack,
}: {
  /** The recovery begun, by its `recoveryMark`. */
  onRecovered(recovery: string): void;
  onBack(): void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const { busy, error, setError, run } = useAction();
  // Checked before the code is spent: a recovery session can only register
  // a passkey (AU-9, AU-13).
  const supported = passkeysSupported();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emptyField(event.currentTarget, "code"))
      return setError("回復コードを入力してください。");
    return run(async () => {
      const { recoveryMark } = await api<{ recoveryMark: string }>(
        "/api/auth/recover",
        { body: { code: code.trim() } },
      );
      tabRecovery(recoveryMark);
      onRecovered(recoveryMark);
    });
  };
  return (
    <>
      <h1 tabIndex={-1}>回復コードで入る</h1>
      {supported ? (
        <>
          <p className="account-lead">
            控えておいた回復コードを1つ入力してください。入ったあと、この端末で新しいパスキーを登録します。使ったコードは無効になります。
          </p>
          <form onSubmit={submit} className="account-form" noValidate>
            <label htmlFor={id}>回復コード</label>
            <input
              id={id}
              className="account-code-input"
              name="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              value={code}
              onChange={(event) => {
                setCode(event.currentTarget.value);
                setError("");
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? id + "error" : undefined}
            />
            {error && (
              <p id={id + "error"} role="alert" className="account-error">
                {error}
              </p>
            )}
            <div className="account-actions">
              <button type="submit" className="account-primary" disabled={busy}>
                回復する
              </button>
            </div>
          </form>
        </>
      ) : (
        <Unsupported>この端末では回復を完了できません。</Unsupported>
      )}
      <div className="account-actions">
        <button type="button" onClick={onBack}>
          ログインに戻る
        </button>
      </div>
    </>
  );
}

// The only step a recovery session may take (AU-9), for the recovery
// `recovery` names. Once the cookies name another session or recovery
// (another tab's sign-in or recovery, whose session replaced this one's),
// the step ends (`onReplaced`) and sends nothing more.
export function RecoveryPasskey({
  recovery,
  onDone,
  onExpired,
  onAbort,
  onReplaced,
}: {
  recovery: string;
  /** The session the registration began, by its mark. */
  onDone(mark: string | null): void;
  onExpired(): void;
  onAbort(): void;
  onReplaced(): void;
}) {
  const { busy, error, setError, run } = useAction();
  const session = usePrivateApi(
    () => {
      tabRecovery(null);
      onReplaced();
    },
    { recovery },
  );
  const register = () =>
    run(
      async () => {
        await addPasskey(session);
        tabRecovery(null);
        // The guard is the session the registration began now.
        onDone(session.mark);
      },
      {
        prompt: true,
        handle(failure) {
          if (isApiError(failure, 401)) {
            tabRecovery(null);
            onExpired();
          } else if (
            failure instanceof DOMException &&
            failure.name === "InvalidStateError"
          )
            // excludeCredentials matched a passkey still on this device.
            setError(
              "この端末にはこのアカウントのパスキーがすでにあります。回復をやめて、そのパスキーでログインしてください。",
            );
          else return false;
          return true;
        },
      },
    );
  // Logout ends a recovery session too; the spent code stays spent.
  const abort = () =>
    run(async () => {
      await logout(session);
      tabRecovery(null);
      onAbort();
    });
  return (
    <>
      <h1 tabIndex={-1}>新しいパスキーを登録</h1>
      <p className="account-lead">
        回復を終えるには、この端末で新しいパスキーを登録してください。登録すると、ほかの端末のログインはすべて終了します。15分以内に登録しないと、回復コードの入力からやり直しになります。
      </p>
      <p>
        この端末にこのアカウントのパスキーが残っているときは、回復をやめてそのパスキーでログインしてください。使った回復コードは戻りません。
      </p>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <div className="account-actions">
        <button
          type="button"
          className="account-primary"
          disabled={busy}
          onClick={register}
        >
          パスキーを登録
        </button>
        <button type="button" disabled={busy} onClick={abort}>
          回復をやめてログインに戻る
        </button>
      </div>
    </>
  );
}

// What follows a recovery's registration, for the session it began
// (`mark`): once the cookies name another, the screen closes (`onLost`),
// and nothing is sent as them.
export function Recovered({
  mark,
  onCodes,
  onSkip,
  onLost,
}: {
  mark: string | null;
  onCodes(codes: string[], mark: string | null): void;
  onSkip(): void;
  onLost(): void;
}) {
  const { busy, error, run } = useAction();
  const session = usePrivateApi(onLost, { mark });
  const reissue = () =>
    run(
      async () => {
        const codes = await reissueRecoveryCodes(session);
        onCodes(codes, session.mark);
      },
      { prompt: true },
    );
  return (
    <>
      <h1 tabIndex={-1}>パスキーを登録しました</h1>
      <p className="account-lead">
        回復コードを1つ使ったので、残りのコードも誰かに見られたおそれがあれば、新しい10個に取り替えてください。取り替えると今のコードはすべて使えなくなります。なくしたパスキーは、アカウントの画面から削除できます。
      </p>
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <div className="account-actions">
        <button
          type="button"
          className="account-primary"
          disabled={busy}
          onClick={reissue}
        >
          回復コードを再発行
        </button>
        <button type="button" onClick={onSkip}>
          あとで
        </button>
      </div>
    </>
  );
}
