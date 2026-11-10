import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "../../shared/ui/site-header";
import { signedIn } from "../../shared/browser/signed-in";
import { ConfirmDialog } from "../account/confirm-dialog";
import {
  friendsApi,
  friendError,
  friendDate,
  type Friend,
  type Request,
  type Block,
  type Invite,
  type Person,
} from "../../features/friends/friends-api";

export function FriendsPage() {
  return (
    <>
      <SiteHeader />
      <main className="account-page">
        {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
          <>
            <h1>フレンド</h1>
            {signedIn() ? (
              <Friends />
            ) : (
              <a href="/account.html?returnTo=%2Ffriends">ログイン・登録へ</a>
            )}
          </>
        ) : (
          <p>フレンド機能はまだ使えません。</p>
        )}
      </main>
    </>
  );
}
function Friends() {
  const [data, setData] = useState<{
    friends: Friend[];
    requests: Request[];
    blocks: Block[];
    invite: Invite;
  } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    person?: Person;
    action: "remove" | "block" | "replace";
  } | null>(null);
  const live = useRef(true);
  const loginLink = useRef<HTMLAnchorElement>(null);
  const focusLogin = useRef(false);
  const confirm = (next: NonNullable<typeof confirmation>) => {
    setError("");
    setConfirmation(next);
  };
  useEffect(() => {
    // The child dialog has closed and released inert before this effect runs.
    if (focusLogin.current && confirmation === null) {
      loginLink.current?.focus();
      focusLogin.current = false;
    }
  }, [confirmation, error]);
  const load = async () => {
    const [friends, requests, blocks, invite] = await Promise.all([
      friendsApi<{ friends: Friend[] }>("/api/friends"),
      friendsApi<{ requests: Request[] }>("/api/friend-requests"),
      friendsApi<{ blocks: Block[] }>("/api/blocks"),
      friendsApi<Invite>("/api/invite"),
    ]);
    if (live.current && signedIn())
      setData((previous) => ({
        ...friends,
        ...requests,
        ...blocks,
        invite: {
          ...invite,
          ...(previous?.invite.url &&
          previous.invite.expiresAt === invite.expiresAt
            ? { url: previous.invite.url }
            : {}),
        },
      }));
  };
  const fail = (cause: unknown) => {
    if (!live.current) return;
    setError(friendError(cause));
    if (!signedIn()) {
      focusLogin.current = true;
      setConfirmation(null);
      setData(null);
    }
  };
  useEffect(() => {
    live.current = true;
    void load().catch(fail);
    const check = () => {
      if (!signedIn()) {
        setData(null);
        setError("ログインし直してください。");
      }
    };
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      live.current = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (cause) {
      fail(cause);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  async function create() {
    const invite = await friendsApi<Invite>("/api/invite", { method: "POST" });
    if (live.current && signedIn()) {
      setData((previous) => previous && { ...previous, invite });
      setConfirmation(null);
    }
  }
  async function change(path: string, method: string) {
    await friendsApi(path, { method });
    // Remove stale private rows even if the subsequent refresh fails.
    if (live.current) {
      setData(null);
      setConfirmation(null);
    }
    await load();
  }
  const personPath = (prefix: string, person: Person) =>
    `${prefix}/${encodeURIComponent(person.userId)}`;
  return (
    <>
      {error && confirmation === null && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      <p role="status" className="account-status">
        {status}
      </p>
      {!signedIn() ? (
        <a ref={loginLink} href="/account.html?returnTo=%2Ffriends">
          ログイン・登録へ
        </a>
      ) : !data ? (
        <>
          <p>
            {error ? "フレンド情報を読み込めませんでした。" : "読み込み中…"}
          </p>
          {error && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(load)}
            >
              再読み込み
            </button>
          )}
        </>
      ) : (
        <>
          <section className="account-section" aria-labelledby="invite-heading">
            <h2 id="invite-heading">招待リンク</h2>
            <p>
              リンクを送った相手が申請し、あなたが承認するとフレンドになります。表示名と受け取り記録がフレンドに見えます。メモは見えません。
            </p>
            {data.invite.expiresAt !== null && (
              <p>
                期限：
                <time dateTime={new Date(data.invite.expiresAt).toISOString()}>
                  {friendDate(data.invite.expiresAt)}{" "}
                  {new Intl.DateTimeFormat("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(data.invite.expiresAt)}
                  （日本時間）
                </time>
              </p>
            )}
            {data.invite.url ? (
              <>
                <label className="friend-invite-label" htmlFor="invite-url">
                  送るリンク
                </label>
                <input
                  id="invite-url"
                  className="friend-invite-url"
                  type="text"
                  readOnly
                  value={data.invite.url}
                  onFocus={(event) => event.target.select()}
                />
                <div className="account-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(data.invite.url!);
                        setStatus("コピーしました");
                      })
                    }
                  >
                    コピー
                  </button>
                  {typeof navigator.share === "function" && (
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          try {
                            await navigator.share({
                              url: data.invite.url,
                              title: "マンホール手帳のフレンド招待",
                            });
                          } catch (error) {
                            if (
                              !(
                                error instanceof DOMException &&
                                error.name === "AbortError"
                              )
                            )
                              throw error;
                          }
                        })
                      }
                    >
                      共有
                    </button>
                  )}
                </div>
              </>
            ) : (
              data.invite.expiresAt !== null && (
                <p>
                  前に作ったリンクは再表示できません。必要なら作り直してください。
                </p>
              )
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                data.invite.expiresAt !== null
                  ? confirm({ action: "replace" })
                  : void run(create)
              }
            >
              {data.invite.expiresAt !== null ? "作り直す" : "招待リンクを作る"}
            </button>
            <p>作り直すと、前の招待リンクは使えなくなります。</p>
          </section>
          <section
            className="account-section"
            aria-labelledby="requests-heading"
          >
            <h2 id="requests-heading">受け取った申請</h2>
            <p>
              承認すると、過去の分も含めてカード・受け取った日・枚数が互いに見えます。メモは見えません。
            </p>
            {!data.requests.length ? (
              <p>申請はありません。</p>
            ) : (
              <ul className="friend-list">
                {data.requests.map((person) => (
                  <li key={person.userId}>
                    <strong>{person.displayName}</strong>
                    <p>申請日：{friendDate(person.requestedAt)}</p>
                    <div className="account-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            change(
                              `${personPath("/api/friend-requests", person)}/accept`,
                              "POST",
                            ),
                          )
                        }
                      >
                        承認
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            change(
                              personPath("/api/friend-requests", person),
                              "DELETE",
                            ),
                          )
                        }
                      >
                        削除
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm({ person, action: "block" })}
                      >
                        ブロック
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            className="account-section"
            aria-labelledby="friends-heading"
          >
            <h2 id="friends-heading">フレンド一覧</h2>
            {!data.friends.length ? (
              <p>フレンドはまだいません。</p>
            ) : (
              <ul className="friend-list">
                {data.friends.map((person) => (
                  <li key={person.userId}>
                    <strong>{person.displayName}</strong>
                    <p>
                      {person.count}枚 · フレンドになった日：
                      {friendDate(person.since)}
                    </p>
                    <a
                      href={`/?${new URLSearchParams({ friend: person.userId })}`}
                    >
                      受け取りマップを見る
                    </a>
                    <div className="account-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm({ person, action: "remove" })}
                      >
                        解除
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm({ person, action: "block" })}
                      >
                        ブロック
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="account-section" aria-labelledby="blocks-heading">
            <h2 id="blocks-heading">ブロック一覧</h2>
            <p>
              ブロックを解除してもフレンドには戻りません。もう一度申請が必要です。
            </p>
            {!data.blocks.length ? (
              <p>ブロックしている人はいません。</p>
            ) : (
              <ul className="friend-list">
                {data.blocks.map((person) => (
                  <li key={person.userId}>
                    <strong>{person.displayName}</strong>
                    <p>ブロックした日：{friendDate(person.blockedAt)}</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          change(personPath("/api/blocks", person), "DELETE"),
                        )
                      }
                    >
                      ブロックを解除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation?.action === "replace"
            ? "招待リンクを作り直しますか？"
            : `${confirmation?.person?.displayName ?? ""}さん${confirmation?.action === "block" ? "をブロックしますか？" : "とのフレンドを解除しますか？"}`
        }
        confirm={
          confirmation?.action === "replace"
            ? "作り直す"
            : confirmation?.action === "block"
              ? "ブロックする"
              : "解除する"
        }
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          const { action, person } = confirmation;
          void run(() =>
            action === "replace"
              ? create()
              : change(
                  personPath(
                    action === "block" ? "/api/blocks" : "/api/friends",
                    person!,
                  ),
                  action === "block" ? "PUT" : "DELETE",
                ),
          );
        }}
      >
        <p>
          {confirmation?.action === "replace"
            ? "前の招待リンクは使えなくなります。"
            : confirmation?.action === "block"
              ? "フレンドと申請が解除され、互いの記録を見られなくなります。相手には通知されません。"
              : "互いの受け取り記録を見られなくなります。"}
        </p>
        <p role="alert" className="account-error" hidden={!error}>
          {error}
        </p>
      </ConfirmDialog>
    </>
  );
}
