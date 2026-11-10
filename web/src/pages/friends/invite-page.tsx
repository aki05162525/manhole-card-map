import { useEffect, useState } from "react";
import { SiteHeader } from "../../shared/ui/site-header";
import { signedIn } from "../../shared/browser/signed-in";
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
  if (location.hash)
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
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
  const [token] = useState(initialToken ?? "");
  const [invite, setInvite] = useState<{
    displayName: string;
    self?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!token) {
      setError(invalid);
      return;
    }
    void friendsApi<{ displayName: string; self?: boolean }>(
      "/api/invite/lookup",
      { body: { token } },
    )
      .then((value) => {
        if (active) {
          setInvite(value);
          if (value.self) clearInviteToken();
        }
      })
      .catch((error) => {
        if (active) {
          setError(isApiError(error, 404) ? invalid : friendError(error));
          if (isApiError(error, 404)) clearInviteToken();
        }
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function request() {
    setBusy(true);
    setError("");
    try {
      await friendsApi("/api/friend-requests", { body: { token } });
      clearInviteToken();
      setSent(true);
      setInvite(null);
    } catch (error) {
      if (isApiError(error, 404)) {
        clearInviteToken();
        setInvite(null);
        setError(invalid);
      } else setError(friendError(error));
    } finally {
      setBusy(false);
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
              {signedIn() ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void request()}
                >
                  申請する
                </button>
              ) : (
                <a
                  href="/account.html?returnTo=%2Ffriends%2Finvite"
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
