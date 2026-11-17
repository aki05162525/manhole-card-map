import { Map as MapIcon, NotebookPen, Users } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { api, isApiError } from "../../features/account/account-api";
import {
  createPasskey,
  getPasskey,
  passkeysSupported,
} from "../../features/account/webauthn";
import { DISPLAY_NAME_EMPTY, DISPLAY_NAME_RULE } from "./messages";
import { emptyField, useAction } from "./use-action";

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
  const { busy, error, run } = useAction();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const supported = passkeysSupported();

  const login = () =>
    run(
      async () => {
        const options = await api<PublicKeyCredentialRequestOptionsJSON>(
          "/api/auth/login/options",
          { method: "POST" },
        );
        const response = await getPasskey(options);
        await api("/api/auth/login/verify", { body: { response } });
        onSignedIn();
      },
      { prompt: true },
    );

  const register = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emptyField(event.currentTarget, "displayName"))
      return setNameError(DISPLAY_NAME_EMPTY);
    setNameError("");
    return run(
      async () => {
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
      },
      {
        prompt: true,
        handle(failure) {
          if (!isApiError(failure, 400, "invalid_display_name")) return false;
          setNameError(DISPLAY_NAME_RULE);
          return true;
        },
      },
    );
  };

  return (
    <>
      <h1 tabIndex={-1}>ログイン</h1>
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
          <section className="account-join" aria-labelledby={id + "new"}>
            <h2 id={id + "new"}>はじめての方へ</h2>
            <ul className="account-benefits">
              <li>
                <NotebookPen size={20} aria-hidden="true" />
                入手したカードを記録
              </li>
              <li>
                <MapIcon size={20} aria-hidden="true" />
                入手済み・未入手で絞り込み
              </li>
              <li>
                <Users size={20} aria-hidden="true" />
                フレンドと入手マップを見せ合う
              </li>
            </ul>
            <form
              onSubmit={register}
              noValidate
              className="account-form"
              aria-labelledby={id + "new"}
            >
              <label htmlFor={id + "name"}>表示名</label>
              <input
                id={id + "name"}
                name="displayName"
                required
                enterKeyHint="go"
                value={name}
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  setNameError("");
                }}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={id + (nameError ? "error" : "hint")}
              />
              {nameError ? (
                <p id={id + "error"} className="account-error">
                  {nameError}
                </p>
              ) : (
                <p id={id + "hint"} className="account-hint">
                  フレンドに見える名前です。あとで変えられます。
                </p>
              )}
              <div className="account-actions">
                <button
                  type="submit"
                  className="account-primary"
                  disabled={busy}
                >
                  アカウントを作る
                </button>
              </div>
              <p className="account-hint">
                メールアドレスもパスワードも使いません。パスキーで作れます。
              </p>
              <p className="account-hint">
                登録の前に
                <a href="/terms">規約とプライバシーポリシー</a>
                をお読みください。
              </p>
            </form>
          </section>
        </>
      ) : (
        <Unsupported>
          この端末ではログインできません。閲覧はそのまま使えます。
        </Unsupported>
      )}
      <p className="account-lost">
        パスキーを使えなくなったときは
        <button
          type="button"
          className="account-text-button"
          onClick={onRecover}
        >
          回復コードで入る
        </button>
      </p>
    </>
  );
}
