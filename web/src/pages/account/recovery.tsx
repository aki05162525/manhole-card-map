import { useId, useState, type FormEvent } from "react";
import { api, isApiError } from "../../features/account/account-api";
import {
  addPasskey,
  cancelled,
  logout,
  passkeysSupported,
  reissueRecoveryCodes,
} from "../../features/account/webauthn";
import { message } from "./messages";
import { Unsupported } from "./sign-in";

const RECOVERING = "account-recovering";

// sessionStorage may throw (blocked storage); the flag only resumes the
// passkey step after a reload.
export function recovering(value?: boolean) {
  try {
    if (value === true) sessionStorage.setItem(RECOVERING, "1");
    else if (value === false) sessionStorage.removeItem(RECOVERING);
    return sessionStorage.getItem(RECOVERING) === "1";
  } catch {
    return false;
  }
}

export function RecoverForm({
  onRecovered,
  onBack,
}: {
  onRecovered(): void;
  onBack(): void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Checked before the code is spent: a recovery session can only register
  // a passkey (AU-9, AU-13).
  const supported = passkeysSupported();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/recover", { body: { code: code.trim() } });
      recovering(true);
      onRecovered();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h1 tabIndex={-1}>回復コードで入る</h1>
      {supported ? (
        <>
          <p className="account-lead">
            控えておいた回復コードを1つ入力してください。入ったあと、この端末で新しいパスキーを登録します。使ったコードは無効になります。
          </p>
          <form onSubmit={submit} className="account-form">
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
              onChange={(event) => setCode(event.currentTarget.value)}
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

// The only step a recovery session may take (AU-9).
export function RecoveryPasskey({
  onDone,
  onExpired,
  onAbort,
}: {
  onDone(): void;
  onExpired(): void;
  onAbort(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = async () => {
    setError("");
    setBusy(true);
    try {
      await addPasskey();
      recovering(false);
      onDone();
    } catch (failure) {
      if (isApiError(failure, 401)) {
        recovering(false);
        onExpired();
      } else if (
        failure instanceof DOMException &&
        failure.name === "InvalidStateError"
      )
        // excludeCredentials matched a passkey still on this device.
        setError(
          "この端末にはこのアカウントのパスキーがすでにあります。回復をやめて、そのパスキーでログインしてください。",
        );
      else if (!cancelled(failure)) setError(message(failure));
    } finally {
      setBusy(false);
    }
  };
  // Logout ends a recovery session too; the spent code stays spent.
  const abort = async () => {
    setError("");
    setBusy(true);
    try {
      await logout();
      recovering(false);
      onAbort();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  };
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

export function Recovered({
  onCodes,
  onSkip,
}: {
  onCodes(codes: string[]): void;
  onSkip(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reissue = async () => {
    setError("");
    setBusy(true);
    try {
      onCodes(await reissueRecoveryCodes());
    } catch (failure) {
      if (!cancelled(failure)) setError(message(failure));
    } finally {
      setBusy(false);
    }
  };
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
