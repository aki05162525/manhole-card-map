import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "../../shared/ui/site-header";
import { onPageReturn, sessionMark, signedIn } from "../../session/signed-in";
import { api, isApiError, UserChanged } from "../../session/account-api";
import { friendError } from "../../features/friends/friends-api";
import { isInviteLookup } from "../../contract/private-api";
import {
  sendGuarded,
  sessionGuard,
  type Owner,
} from "../../session/session-guard";
import {
  clearInviteToken,
  takeInviteToken,
  saveInviteToken,
} from "../../session/invite-token";
const invalid =
  "この招待リンクは使えません。新しいリンクを送ってもらってください。";
const EXPIRED = "もう一度招待リンクを開いてください";
// The page looks the invitation up again as the user signed in now, who
// may press once more.
const CHANGED =
  "申請の途中でほかのタブの利用者が替わったため、申請できたか確かめられませんでした。今の利用者として招待を確かめ直しました。申請する場合は、もう一度押してください。";
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
  // The lookup's answer, for the user it was asked as (`asked`): `self`
  // and the button are that user's only.
  const [invite, setInvite] = useState<{
    displayName: string;
    self?: boolean;
    asked: string | null;
  } | null>(null);
  const [error, setError] = useState(initialToken ? "" : invalid);
  // Why the invitation was looked up again (`CHANGED`): kept through the
  // lookup it starts, which clears `error`, and gone with the next change.
  const [notice, setNotice] = useState("");
  // The request, a private one, goes through the page's guard: sent as the
  // user signed in as it is pressed, and dropped once the page is left.
  const [guard] = useState(sessionGuard);
  // The owner the request was taken for: told as made only while the
  // guard still holds it (`owns`), and cleared by a change of user.
  const [sent, setSent] = useState<Owner | null>(null);
  const [busy, setBusy] = useState(false);
  // Signed in, out or as another user since the page last looked, or a
  // saved token taken: the lookup starts again for whoever is signed in.
  const [check] = useState(() => (event?: Event) => {
    // This page's own 401 (`request`) keeps the token for re-login; the
    // checks hear only another tab's sign-in or logout.
    if (event?.type === "sessionchange") return;
    const now = viewer();
    const next = now !== null;
    const pending = takeInviteToken();
    const loggedOut = seen.current !== null && !next;
    if (seen.current !== now || pending !== null) {
      generation.current++;
      setRevision(generation.current);
      setBusy(false);
      // What the page told the user before is not the new one's.
      setSent(null);
      setNotice("");
    }
    // Another user, or none: the request on its way is the one before's.
    if (seen.current !== now) guard.restart();
    seen.current = now;
    setAuthenticated(next);
    if (loggedOut) {
      setToken("");
      setInvite(null);
      setSent(null);
      setBusy(false);
      setExpired(true);
      setError(EXPIRED);
    } else if (pending !== null) {
      setToken(pending);
      setExpired(false);
      setSent(null);
      setError("");
    }
  });
  useEffect(() => {
    guard.open();
    const stop = onPageReturn(check);
    check();
    return () => {
      stop();
      guard.close();
    };
  }, [check, guard]);
  // What is shown is of one lookup (`lookup`): as another starts, the
  // answer and the error of the one before go, before they are drawn.
  const [lookup, setLookup] = useState({
    token,
    authenticated,
    expired,
    revision,
  });
  if (
    lookup.token !== token ||
    lookup.authenticated !== authenticated ||
    lookup.expired !== expired ||
    lookup.revision !== revision
  ) {
    setLookup({ token, authenticated, expired, revision });
    setInvite(null);
    setError(token ? "" : expired ? EXPIRED : invalid);
  }
  useEffect(() => {
    if (!token) return;
    let active = true;
    const current = generation.current;
    const asked = viewer();
    // Open to anyone; signed in, it tells an invite of one's own. Answered
    // once another user, or none, is signed in, it is asked again as them.
    const stillAsked = () => {
      if (!active || generation.current !== current) return false;
      if (viewer() === asked) return true;
      check();
      return false;
    };
    void api("/api/invite/lookup", { body: { token }, read: isInviteLookup })
      .then((value) => {
        if (!stillAsked()) return;
        setInvite({ ...value, asked });
        if (value.self) clearInviteToken();
      })
      .catch((error: unknown) => {
        if (!stillAsked()) return;
        setError(isApiError(error, 404) ? invalid : friendError(error));
        if (isApiError(error, 404)) clearInviteToken();
      });
    return () => {
      active = false;
    };
  }, [token, authenticated, revision, check]);
  async function request() {
    // Looked up as another user than is signed in now, and the page has
    // not heard of it yet: it is looked up again, and nothing is sent.
    if (invite?.asked !== viewer()) {
      check();
      return;
    }
    const current = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // As the user signed in when it is pressed, the one it was looked up
      // as: an answer or failure that comes back once another has signed
      // in, or none, or once the page is left, is not theirs (PF-5).
      if (!guard.current()) guard.restart();
      const { owner } = await sendGuarded(guard, () =>
        api("/api/friend-requests", { body: { token } }),
      );
      if (generation.current !== current) return;
      clearInviteToken();
      setSent(owner);
      setInvite(null);
    } catch (error) {
      if (generation.current !== current) return;
      setAuthenticated(signedIn());
      if (isApiError(error, 404)) {
        clearInviteToken();
        setInvite(null);
        setError(invalid);
      } else if (error instanceof UserChanged) {
        // As a return does: looked up again as the user signed in now, and
        // nothing more is sent.
        check();
        setNotice(CHANGED);
      } else setError(friendError(error));
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  // The lookup is drawn only for the user it was asked as (no side effect:
  // the cookies are read only): `self` and the button are theirs. Once the
  // cookies name another, it shows as being checked until a press or a
  // return looks it up again.
  const shown = invite && invite.asked === viewer() ? invite : null;
  return (
    <>
      <h1>フレンドの招待</h1>
      {sent && guard.owns(sent) ? (
        <p role="status">申請しました</p>
      ) : (
        <>
          {shown?.self ? (
            <p>これはあなたの招待リンクです</p>
          ) : shown ? (
            <>
              <p>{shown.displayName}さんからの招待</p>
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
          {(error || notice) && <p role="alert">{error || notice}</p>}
        </>
      )}
      <p>
        <a href="/friends">フレンドへ</a>
      </p>
    </>
  );
}
