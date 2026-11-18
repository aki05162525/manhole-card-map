import { Map as MapIcon, NotebookPen, Users } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import {
  api,
  beginSession,
  isApiError,
  UserChanged,
} from "../../session/account-api";
import { signalUnknownPasskey } from "./passkey-signals";
import {
  createPasskey,
  getPasskey,
  isCreationOptions,
  isRequestOptions,
  passkeysSupported,
  verifyCreated,
} from "./webauthn";
import { isRecoveryCodes } from "../../contract/private-api";
import { signedIn } from "../../session/signed-in";
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

const CODES_LOST =
  "登録しましたが、登録の途中でほかのタブのログイン状態が変わったため、回復コードを表示できませんでした。ログインしてから、アカウントの画面で回復コードを再発行してください。";

export function SignIn({
  onSignedIn,
  onRegistered,
  onRecover,
}: {
  onSignedIn(): void;
  /** The codes, for the session (`mark`) the registration began. */
  onRegistered(codes: string[], mark: string): void;
  onRecover(): void;
}) {
  const id = useId();
  const { busy, error, setError, run } = useAction();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const supported = passkeysSupported();

  const login = () =>
    run(
      async () => {
        const options = await api("/api/auth/login/options", {
          method: "POST",
          read: isRequestOptions,
        });
        const response = await getPasskey(options);
        try {
          await api("/api/auth/login/verify", { body: { response } });
        } catch (failure) {
          // Deleted here but still offered by the passkey manager. Only
          // while nobody is signed in: the 404 is then about this passkey.
          if (isApiError(failure, 404, "unknown_credential") && !signedIn())
            signalUnknownPasskey(options.rpId, response.id);
          throw failure;
        }
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
        const options = await api("/api/auth/register/options", {
          body: { displayName: name },
          read: isCreationOptions,
        });
        const response = await createPasskey(options);
        const { value, mark } = await verifyCreated(options, response, () =>
          beginSession(
            "/api/auth/register/verify",
            { displayName: name, response },
            isRecoveryCodes,
          ),
        );
        onRegistered(value.recoveryCodes, mark);
      },
      {
        prompt: true,
        handle(failure) {
          if (failure instanceof UserChanged) {
            // Registered, but the codes are not shown to whoever is now.
            setError(CODES_LOST);
            return true;
          }
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
