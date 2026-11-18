import { useEffect, useRef, useState } from "react";
import { accountReturn } from "../../shared/browser/account-return";
import { navigate } from "../../shared/browser/app-history";
import {
  forgetSignedIn,
  recoveryMark,
  sessionChanged,
  sessionMark,
  signedIn,
} from "../../shared/browser/signed-in";
import { SiteHeader } from "../../shared/ui/site-header";
import {
  RecoverForm,
  Recovered,
  RecoveryPasskey,
  tabRecovery,
} from "./recovery";
import { CodesDiscarded, RecoveryCodes } from "./recovery-codes";
import { Settings } from "./settings";
import { SignIn } from "./sign-in";

type View =
  | { name: "signin"; notice?: string }
  | { name: "recover" }
  // The step of the recovery `recovery` names (`recoveryMark`).
  | { name: "recovery-passkey"; recovery: string }
  // After the registration that began the session `mark` names.
  | { name: "recovered"; mark: string | null }
  // The codes of the session `mark` names (`RecoveryCodes`).
  | { name: "codes"; codes: string[]; mark: string | null }
  // The codes were left on screen too long and are gone.
  | { name: "codes-discarded" }
  | { name: "settings" }
  | { name: "deleted" };

// This tab's recovery is no longer the one the cookies name (another tab's
// recovery replaced it, or its name ran out with it), and no session shows.
const RECOVERY_REPLACED =
  "ほかのタブで回復を始めたか、回復の期限が切れたため、このタブの回復を終えました。別の回復コードでやり直してください。";

// The settings were refused as a recovery's: one this tab did not begin
// (one of this tab's ends before its settings open, `initialView`).
const RECOVERY_ELSEWHERE =
  "回復の途中のセッションになっているため、設定を閉じました。回復を始めたタブで続けるか、パスキーでログインするか、回復コードで入り直してください。";

function initialView(): View {
  const recovery = tabRecovery();
  // Signed in, a recovery of this tab's is over (a recovery session has no
  // display cookies, AU-9): its step would act as this user.
  if (signedIn()) {
    tabRecovery(null);
    return { name: "settings" };
  }
  // A reload during recovery returns to the only allowed step (AU-9), while
  // the cookies still name that recovery: another tab's since replaced it.
  if (recovery !== null) {
    if (recovery === recoveryMark())
      return { name: "recovery-passkey", recovery };
    tabRecovery(null);
    return { name: "signin", notice: RECOVERY_REPLACED };
  }
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
          onRecovered={(recovery) => go({ name: "recovery-passkey", recovery })}
          onBack={signin}
        />
      );
      break;
    case "recovery-passkey":
      content = (
        <RecoveryPasskey
          recovery={view.recovery}
          onDone={(mark) => go({ name: "recovered", mark })}
          onExpired={() =>
            go({
              name: "signin",
              notice:
                "回復の期限（15分）が切れました。別の回復コードでやり直してください。",
            })
          }
          onAbort={signin}
          onReplaced={() =>
            go(
              signedIn()
                ? { name: "settings" }
                : { name: "signin", notice: RECOVERY_REPLACED },
            )
          }
        />
      );
      break;
    case "recovered":
      content = (
        <Recovered
          mark={view.mark}
          onCodes={(codes, mark) => go({ name: "codes", codes, mark })}
          onSkip={settings}
          onLost={() =>
            go(signedIn() ? { name: "settings" } : { name: "signin" })
          }
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
          onRecovery={(mark) => {
            // Checked, forgotten and switched in one step: the refused
            // request was sent with the cookies `mark` names, and any others
            // now are another tab's sign-in, whose settings are read instead.
            if (!signedIn() || sessionMark() !== mark) return false;
            // The session is a recovery's, which has no display cookies
            // (AU-9): those left are not a session's. The recovery is not
            // this tab's (none is kept once the settings open), so the
            // refusal only closes them: its step stays with the tab that
            // began it, and this one never registers or gives it up.
            forgetSignedIn();
            go({ name: "signin", notice: RECOVERY_ELSEWHERE });
            return true;
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
