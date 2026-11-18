import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "../../shared/ui/site-header";
import {
  onPageReturn,
  sessionMark,
  signedIn,
} from "../../shared/browser/signed-in";
import {
  api,
  isApiError,
  UserChanged,
} from "../../features/account/account-api";
import { friendError } from "../../features/friends/friends-api";
import {
  sendGuarded,
  sessionGuard,
  type SessionGuard,
} from "../../shared/browser/session-guard";
import {
  clearInviteToken,
  takeInviteToken,
  saveInviteToken,
} from "../../shared/browser/invite-token";
const invalid =
  "この招待リンクは使えません。新しいリンクを送ってもらってください。";
// This page does not start again: the new user may press once more.
const CHANGED =
  "申請の途中でほかのタブの利用者が替わったため、申請できたか確かめられませんでした。申請する場合は、もう一度押してください。";
// Whom a lookup is for: `self` in its answer tells that user's own invite.
const viewer = () => (signedIn() ? sessionMark() : null);
// Called before mounting React, so StrictMode never loses the fragment.
export function captureInvite() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("t");
  if (location.hash) {
    /* oxlint-disable no-restricted-globals -- 招待ページは同じ文書で切り替える画面ではない。フラグメントを消すだけで、画面の履歴項目を持たない。 */
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    /* oxlint-enable no-restricted-globals */
  }
  const pending = takeInviteToken();
  return (
    token ??
    (import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && signedIn()
      ? pending
      : null)
  );
}

export function InvitePage({ initialToken }: { initialToken: string | null }) {
  return (
    <>
      <SiteHeader />
      <main className="account-page">
        {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
          <Invitation initialToken={initialToken} />
        ) : (
          <p>フレンド機能はまだ使えません。</p>
        )}
      </main>
    </>
  );
}
function Invitation({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken ?? "");
  const [authenticated, setAuthenticated] = useState(signedIn);
  // The user (a session mark, or null signed out) the page last saw.
  const seen = useRef(viewer());
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const [expired, setExpired] = useState(false);
  const [invite, setInvite] = useState<{
    displayName: string;
    self?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // The guard of the request on its way, closed when the page is left.
  const requesting = useRef<SessionGuard | null>(null);
  // Signed in, out or as another user since the page last looked, or a
  // saved token taken: the lookup starts again for whoever is signed in.
  const [check] = useState(() => (event?: Event) => {
    if (
      (event?.type === "visibilitychange" &&
        document.visibilityState !== "visible") ||
      // This page's own 401 (`request`) keeps the token for re-login; the
      // checks hear only another tab's sign-in or logout.
      event?.type === "sessionchange"
    )
      return;
    const now = viewer();
    const next = now !== null;
    const pending = takeInviteToken();
    const loggedOut = seen.current !== null && !next;
    if (seen.current !== now || pending !== null) {
      generation.current++;
      setRevision(generation.current);
      setBusy(false);
    }
    seen.current = now;
    setAuthenticated(next);
    if (loggedOut) {
      setToken("");
      setInvite(null);
      setSent(false);
      setBusy(false);
      setExpired(true);
      setError("もう一度招待リンクを開いてください");
    } else if (pending !== null) {
      setToken(pending);
      setExpired(false);
      setSent(false);
      setError("");
    }
  });
  useEffect(() => {
    const stop = onPageReturn(check);
    check();
    return () => {
      stop();
      requesting.current?.close();
    };
  }, [check]);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    setInvite(null);
    setError("");
    if (!token) {
      setError(expired ? "もう一度招待リンクを開いてください" : invalid);
      return;
    }
    const asked = viewer();
    // Open to anyone; signed in, it tells an invite of one's own. Answered
    // once another user, or none, is signed in, it is asked again as them.
    const stillAsked = () => {
      if (!active || generation.current !== current) return false;
      if (viewer() === asked) return true;
      check();
      return false;
    };
    void api<{ displayName: string; self?: boolean }>("/api/invite/lookup", {
      body: { token },
    })
      .then((value) => {
        if (!stillAsked()) return;
        setInvite(value);
        if (value.self) clearInviteToken();
      })
      .catch((error) => {
        if (!stillAsked()) return;
        setError(isApiError(error, 404) ? invalid : friendError(error));
        if (isApiError(error, 404)) clearInviteToken();
      });
    return () => {
      active = false;
    };
  }, [token, authenticated, expired, revision, check]);
  async function request() {
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      // As the user signed in when it is pressed: an answer or failure that
      // comes back once another has signed in, or none, or once the page is
      // left, is not theirs (PF-5).
      const guard = sessionGuard();
      requesting.current = guard;
      await sendGuarded(guard, () =>
        api("/api/friend-requests", { body: { token } }),
      );
      if (generation.current !== current) return;
      clearInviteToken();
      setSent(true);
      setInvite(null);
    } catch (error) {
      if (generation.current !== current) return;
      setAuthenticated(signedIn());
      if (isApiError(error, 404)) {
        clearInviteToken();
        setInvite(null);
        setError(invalid);
      } else if (error instanceof UserChanged) setError(CHANGED);
      else setError(friendError(error));
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  return (
    <>
      <h1>フレンドの招待</h1>
      {sent ? (
        <p role="status">申請しました</p>
      ) : (
        <>
          {invite?.self ? (
            <p>これはあなたの招待リンクです</p>
          ) : invite ? (
            <>
              <p>{invite.displayName}さんからの招待</p>
              {authenticated ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void request()}
                >
                  申請する
                </button>
              ) : (
                <a
                  href="/account?returnTo=%2Ffriends%2Finvite"
                  onClick={(event) => {
                    try {
                      saveInviteToken(token);
                    } catch {
                      event.preventDefault();
                      setError(
                        "招待を引き継ぐには、このタブの保存を許可してください。",
                      );
                    }
                  }}
                >
                  ログイン・登録へ
                </a>
              )}
            </>
          ) : (
            !error && <p role="status">招待を確認中…</p>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      )}
      <p>
        <a href="/friends">フレンドへ</a>
      </p>
    </>
  );
}
