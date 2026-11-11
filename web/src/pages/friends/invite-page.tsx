import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "../../shared/ui/site-header";
import { onPageReturn, signedIn } from "../../shared/browser/signed-in";
import { isApiError } from "../../features/account/account-api";
import { friendsApi, friendError } from "../../features/friends/friends-api";
import {
  clearInviteToken,
  takeInviteToken,
  saveInviteToken,
} from "../../shared/browser/invite-token";
const invalid =
  "この招待リンクは使えません。新しいリンクを送ってもらってください。";
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
  const previousAuth = useRef(authenticated);
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
  useEffect(() => {
    const check = (event?: Event) => {
      if (
        event?.type === "visibilitychange" &&
        document.visibilityState !== "visible"
      )
        return;
      const next = signedIn();
      const pending = takeInviteToken();
      const loggedOut = previousAuth.current && !next;
      if (previousAuth.current !== next || pending !== null) {
        generation.current++;
        setRevision(generation.current);
        setBusy(false);
      }
      previousAuth.current = next;
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
    };
    const stop = onPageReturn(check);
    check();
    return stop;
  }, []);
  useEffect(() => {
    let active = true;
    const current = generation.current;
    setInvite(null);
    setError("");
    if (!token) {
      setError(expired ? "もう一度招待リンクを開いてください" : invalid);
      return;
    }
    void friendsApi<{ displayName: string; self?: boolean }>(
      "/api/invite/lookup",
      { body: { token } },
    )
      .then((value) => {
        if (active && generation.current === current) {
          setInvite(value);
          if (value.self) clearInviteToken();
        }
      })
      .catch((error) => {
        if (active && generation.current === current) {
          setError(isApiError(error, 404) ? invalid : friendError(error));
          if (isApiError(error, 404)) clearInviteToken();
        }
      });
    return () => {
      active = false;
    };
  }, [token, authenticated, expired, revision]);
  async function request() {
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      await friendsApi("/api/friend-requests", { body: { token } });
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
      } else setError(friendError(error));
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
