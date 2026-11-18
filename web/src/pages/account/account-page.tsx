import { useEffect, useRef, useState } from "react";
import { accountReturn } from "../../shared/browser/account-return";
import { navigate } from "../../shared/browser/app-history";
import {
  forgetSignedIn,
  sessionChanged,
  signedIn,
} from "../../shared/browser/signed-in";
import { SiteHeader } from "../../shared/ui/site-header";
import {
  RecoverForm,
  Recovered,
  RecoveryPasskey,
  recovering,
} from "./recovery";
import { CodesDiscarded, RecoveryCodes } from "./recovery-codes";
import { Settings } from "./settings";
import { SignIn } from "./sign-in";

type View =
  | { name: "signin"; notice?: string }
  | { name: "recover" }
  | { name: "recovery-passkey" }
  | { name: "recovered" }
  // The codes of the session `mark` names (`RecoveryCodes`).
  | { name: "codes"; codes: string[]; mark: string | null }
  // The codes were left on screen too long and are gone.
  | { name: "codes-discarded" }
  | { name: "settings" }
  | { name: "deleted" };

function initialView(): View {
  // Signed in, a recovery of this tab's is over (a recovery session has no
  // display cookies, AU-9): its step would act as this user.
  if (signedIn()) {
    recovering(false);
    return { name: "settings" };
  }
  // A reload during recovery returns to the only allowed step (AU-9).
  if (recovering()) return { name: "recovery-passkey" };
  if (new URLSearchParams(location.search).has("recover"))
    return { name: "recover" };
  return { name: "signin" };
}

// A disabled build keeps none of the account code (as the records do).
export function AccountPage() {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <Account />
  ) : (
    <>
      <SiteHeader current="account" />
      <main className="account-page">
        <h1>アカウント</h1>
        <p>アカウント機能はまだ使えません。地図と一覧はそのまま使えます。</p>
        <p>
          <a href="/">地図へ</a>
        </p>
      </main>
    </>
  );
}

function Account() {
  const [view, setView] = useState<View>(initialView);
  // The pressed button is gone after a switch: move focus to the new
  // heading so screen readers announce it. Not on the first render.
  const moved = useRef(false);
  // Left for another screen of the document: a ceremony that ends later
  // still signs in, but no longer moves the page.
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  // Every step may have signed in, registered or signed out: the header and
  // the records of the other screens follow.
  const go = (next: View) => {
    sessionChanged();
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
      sessionChanged();
      if (shown.current) navigate(next);
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
            onRegistered={(codes, mark) => go({ name: "codes", codes, mark })}
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
          onReplaced={() => go({ name: "settings" })}
        />
      );
      break;
    case "recovered":
      content = (
        <Recovered
          onCodes={(codes, mark) => go({ name: "codes", codes, mark })}
          onSkip={settings}
        />
      );
      break;
    case "codes":
      content = (
        <RecoveryCodes
          codes={view.codes}
          mark={view.mark}
          onDone={settings}
          onDiscard={() => go({ name: "codes-discarded" })}
          onLost={() =>
            go(
              signedIn()
                ? { name: "settings" }
                : {
                    name: "signin",
                    notice:
                      "ほかのタブでログアウトしたため、回復コードの表示を閉じました。",
                  },
            )
          }
        />
      );
      break;
    case "codes-discarded":
      content = <CodesDiscarded onNext={() => go({ name: "settings" })} />;
      break;
    case "settings":
      content = (
        <Settings
          onSignedOut={signin}
          onRecovery={() => {
            // The session is a recovery's, which has no display cookies
            // (AU-9): any left are not a session's, and its step asks only
            // with none.
            forgetSignedIn();
            recovering(true);
            go({ name: "recovery-passkey" });
          }}
          onCodes={(codes, mark) => go({ name: "codes", codes, mark })}
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
  return (
    <>
      <SiteHeader current="account" />
      <main className="account-page">{content}</main>
    </>
  );
}
