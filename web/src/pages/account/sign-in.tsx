import { useId, useState, type FormEvent } from "react";
import { api, isApiError } from "../../features/account/account-api";
import {
  cancelled,
  createPasskey,
  getPasskey,
  passkeysSupported,
} from "../../features/account/webauthn";
import { DISPLAY_NAME_RULE, message } from "./messages";

export function Unsupported({ children }: { children: string }) {
  return (
    <div className="account-notice">
      <p>
        <strong>{children}</strong>
      </p>
      <p>
        Safari や Chrome
        など端末の標準のブラウザーで開き直すか、パスキーを使える別の端末でログインしてください。パソコンでは、スマートフォンに保存したパスキーを、画面のQRコードを読み取って使えます。
      </p>
    </div>
  );
}

export function SignIn({
  onSignedIn,
  onRegistered,
  onRecover,
}: {
  onSignedIn(): void;
  onRegistered(codes: string[]): void;
  onRecover(): void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const supported = passkeysSupported();

  const login = async () => {
    setError("");
    setBusy(true);
    try {
      const options = await api<PublicKeyCredentialRequestOptionsJSON>(
        "/api/auth/login/options",
        { method: "POST" },
      );
      const response = await getPasskey(options);
      await api("/api/auth/login/verify", { body: { response } });
      onSignedIn();
    } catch (failure) {
      if (!cancelled(failure)) setError(message(failure));
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNameError("");
    setBusy(true);
    try {
      const options = await api<PublicKeyCredentialCreationOptionsJSON>(
        "/api/auth/register/options",
        { body: { displayName: name } },
      );
      const response = await createPasskey(options);
      const result = await api<{ recoveryCodes: string[] }>(
        "/api/auth/register/verify",
        { body: { displayName: name, response } },
      );
      onRegistered(result.recoveryCodes);
    } catch (failure) {
      if (isApiError(failure, 400, "invalid_display_name"))
        setNameError(DISPLAY_NAME_RULE);
      else if (!cancelled(failure)) setError(message(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>ログイン</h1>
      <p>
        ログインすると、受け取ったカードを記録できます。ログインしなくても、地図と一覧はこれまでどおり使えます。
      </p>
      {supported ? (
        <>
          <div className="account-actions">
            <button
              type="button"
              className="account-primary"
              disabled={busy}
              onClick={login}
            >
              パスキーでログイン
            </button>
          </div>
          {error && (
            <p role="alert" className="account-error">
              {error}
            </p>
          )}
          <section className="account-section" aria-labelledby={id + "new"}>
            <h2 id={id + "new"}>はじめて使う</h2>
            <p>
              メールアドレスやパスワードは使いません。この端末のパスキー（指紋・顔・画面ロック）でアカウントを作ります。作成後に表示する回復コード10個を控えてください。
            </p>
            <p className="account-warning">
              パスキーと回復コードを両方失うと、アカウントを復旧できません。
            </p>
            <p>
              登録の前に
              <a href="/terms.html">規約とプライバシーポリシー</a>
              をお読みください。
            </p>
            <form onSubmit={register} className="account-form">
              <label htmlFor={id + "name"}>表示名</label>
              <p id={id + "hint"} className="account-hint">
                フレンドに表示します。あとから変えられます。
              </p>
              <input
                id={id + "name"}
                name="displayName"
                required
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={id + (nameError ? "error" : "hint")}
              />
              {nameError && (
                <p id={id + "error"} className="account-error">
                  {nameError}
                </p>
              )}
              <div className="account-actions">
                <button type="submit" disabled={busy}>
                  パスキーを作る
                </button>
              </div>
            </form>
          </section>
        </>
      ) : (
        <Unsupported>
          この端末ではログインできません。閲覧はそのまま使えます。
        </Unsupported>
      )}
      <section className="account-section" aria-labelledby={id + "lost"}>
        <h2 id={id + "lost"}>パスキーを使えなくなったとき</h2>
        <div className="account-actions">
          <button type="button" onClick={onRecover}>
            回復コードで入る
          </button>
        </div>
      </section>
    </>
  );
}
