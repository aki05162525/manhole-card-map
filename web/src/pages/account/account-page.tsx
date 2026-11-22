import { useEffect, useRef, useState } from "react";
import { accountReturn } from "./account-return";
import { navigate } from "../../shared/browser/app-history";
import {
  recoveryMark,
  sessionChanged,
  signedIn,
} from "../../session/signed-in";
import { SiteHeader } from "../../shared/ui/site-header";
import { forgetRefusedAhead, refusedAhead } from "../../session/private-reads";
import { RecoverForm, Recovered, RecoveryPasskey } from "./recovery";
import { tabRecovery } from "../../session/tab-recovery";
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
  "別のタブで復旧手続きを始めたか、有効期限が切れたため、このタブでの手続きを中断しました。別の回復コードでやり直してください。";

// The settings were refused as a recovery's: one this tab did not begin
// (one of this tab's ends before its settings open, `initialView`), as
// they were open or as they were read ahead of their screen.
const RECOVERY_ELSEWHERE =
  "アカウント復旧の手続きが途中の状態のため、設定画面を閉じました。手続きを始めたタブで続けるか、パスキーでログインし直してください。やり直す場合は、改めて回復コードを入力してください。";

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
  // The read ahead of the settings was refused so, and the guard has
  // forgotten the display cookies left: the sign-in says why, once.
  if (refusedAhead()) return { name: "signin", notice: RECOVERY_ELSEWHERE };
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
        <p>
          現在、アカウント機能は利用できません。地図と一覧はそのままご利用いただけます。
        </p>
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
    forgetRefusedAhead();
    return () => {
      shown.current = false;
    };
  }, []);
  // After an end the guard has taken and told every screen of (a logout, a
  // deletion, a recovery given up, a 401, a refusal as a recovery's
  // session's): the screen only moves on, and tells nothing more.
  const move = (next: View) => {
    moved.current = true;
    setView(next);
  };
  // Every other step may have signed in or registered: the header and the
  // records of the other screens follow.
  const go = (next: View) => {
    sessionChanged();
    move(next);
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
                "復旧手続きの期限（15分）が切れました。別の回復コードでやり直してください。",
            })
          }
          onAbort={() => move({ name: "signin" })}
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
                      "別のタブでログアウトしたため、回復コードの表示を閉じました。",
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
          onSignedOut={() => move({ name: "signin" })}
          // The session is a recovery's, which has no display cookies
          // (AU-9): the guard has forgotten those left, in the same step as
          // it took the refusal as the settings' owner's (one that came
          // back once another user signed in has their settings read
          // instead), and the settings have gone to sign-in as signed out;
          // this says why. The recovery is not this tab's (none is kept once
          // the settings open), so the refusal only closes them: its step
          // stays with the tab that began it, and this one never registers
          // or gives it up.
          onRecovery={() =>
            move({ name: "signin", notice: RECOVERY_ELSEWHERE })
          }
          onCodes={(codes, mark) => go({ name: "codes", codes, mark })}
          onDeleted={() => move({ name: "deleted" })}
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
