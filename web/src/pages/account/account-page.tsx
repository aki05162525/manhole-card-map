import { useEffect, useRef, useState } from "react";
import { accountReturn } from "../../shared/browser/account-return";
import { signedIn } from "../../shared/browser/signed-in";
import { SiteHeader } from "../../shared/ui/site-header";
import {
  RecoverForm,
  Recovered,
  RecoveryPasskey,
  recovering,
} from "./recovery";
import { RecoveryCodes } from "./recovery-codes";
import { Settings } from "./settings";
import { SignIn } from "./sign-in";

type View =
  | { name: "signin"; notice?: string }
  | { name: "recover" }
  | { name: "recovery-passkey" }
  | { name: "recovered" }
  | { name: "codes"; codes: string[] }
  | { name: "settings" }
  | { name: "deleted" };

function initialView(): View {
  // A reload during recovery returns to the only allowed step (AU-9).
  if (recovering()) return { name: "recovery-passkey" };
  if (signedIn()) return { name: "settings" };
  if (new URLSearchParams(location.search).has("recover"))
    return { name: "recover" };
  return { name: "signin" };
}

// A disabled build keeps none of the account code (as the records do).
export function AccountPage() {
  return (
    <>
      <SiteHeader current="account" />
      <main className="account-page">
        {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
          <Account />
        ) : (
          <>
            <h1>アカウント</h1>
            <p>
              アカウント機能はまだ使えません。地図と一覧はそのまま使えます。
            </p>
            <p>
              <a href="/">地図へ</a>
            </p>
          </>
        )}
      </main>
    </>
  );
}

function Account() {
  const [view, setView] = useState<View>(initialView);
  // The pressed button is gone after a switch: move focus to the new
  // heading so screen readers announce it. Not on the first render.
  const moved = useRef(false);
  const go = (next: View) => {
    moved.current = true;
    setView(next);
  };
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>(".account-page h1")?.focus();
  }, [view]);
  const settings = () => {
    const next = accountReturn();
    if (next) {
      location.assign(next);
      return;
    }
    go({ name: "settings" });
  };
  const signin = () => go({ name: "signin" });
  let content;
  switch (view.name) {
    case "signin":
      content = (
        <>
          {view.notice && (
            <p role="alert" className="account-error">
              {view.notice}
            </p>
          )}
          <SignIn
            onSignedIn={settings}
            onRegistered={(codes) => go({ name: "codes", codes })}
            onRecover={() => go({ name: "recover" })}
          />
        </>
      );
      break;
    case "recover":
      content = (
        <RecoverForm
          onRecovered={() => go({ name: "recovery-passkey" })}
          onBack={signin}
        />
      );
      break;
    case "recovery-passkey":
      content = (
        <RecoveryPasskey
          onDone={() => go({ name: "recovered" })}
          onExpired={() =>
            go({
              name: "signin",
              notice:
                "回復の期限（15分）が切れました。別の回復コードでやり直してください。",
            })
          }
          onAbort={signin}
        />
      );
      break;
    case "recovered":
      content = (
        <Recovered
          onCodes={(codes) => go({ name: "codes", codes })}
          onSkip={settings}
        />
      );
      break;
    case "codes":
      content = <RecoveryCodes codes={view.codes} onDone={settings} />;
      break;
    case "settings":
      content = (
        <Settings
          onSignedOut={signin}
          onRecovery={() => {
            recovering(true);
            go({ name: "recovery-passkey" });
          }}
          onCodes={(codes) => go({ name: "codes", codes })}
          onDeleted={() => go({ name: "deleted" })}
        />
      );
      break;
    case "deleted":
      content = (
        <>
          <h1 tabIndex={-1}>アカウントを削除しました</h1>
          <p>地図と一覧はこれまでどおり使えます。</p>
          <p>
            <a href="/">地図へ</a>
          </p>
        </>
      );
  }
  return content;
}
