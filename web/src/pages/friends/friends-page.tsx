import { useEffect, useRef, useState, type ReactNode } from "react";
import { Map as MapIcon } from "lucide-react";
import { SiteHeader } from "../../shared/ui/site-header";
import { onPageReturn, signedIn } from "../../shared/browser/signed-in";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
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
import { InviteSection } from "./invite-section";

const LOGIN_HREF = "/account?returnTo=%2Ffriends";

type Confirmation = {
  person?: Person;
  action: "remove" | "block" | "replace";
};
// What the dialog says for each action; `name` is the other person.
const confirmations: Record<
  Confirmation["action"],
  { title(name: string): string; confirm: string; body: string }
> = {
  replace: {
    title: () => "招待リンクを作り直しますか？",
    confirm: "作り直す",
    body: "前の招待リンクは使えなくなります。",
  },
  block: {
    title: (name) => `${name}さんをブロックしますか？`,
    confirm: "ブロックする",
    body: "フレンドと申請が解除され、互いの記録を見られなくなります。相手には通知されません。",
  },
  remove: {
    title: (name) => `${name}さんとのフレンドを解除しますか？`,
    confirm: "解除する",
    body: "互いの回収の記録を見られなくなります。",
  },
};

export function FriendsPage() {
  return (
    <>
      <SiteHeader current="friends" />
      <main className="account-page">
        {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
          <>
            <h1>フレンド</h1>
            {signedIn() ? (
              <Friends />
            ) : (
              <a href={LOGIN_HREF}>ログイン・登録へ</a>
            )}
          </>
        ) : (
          <p>フレンド機能はまだ使えません。</p>
        )}
      </main>
    </>
  );
}

/** One row per person: the name, then what the caller adds. */
function PersonList<T extends Person>({
  people,
  children,
}: {
  people: T[];
  children(person: T): ReactNode;
}) {
  return (
    <ul className="friend-list">
      {people.map((person) => (
        <li key={person.userId}>
          <strong>{person.displayName}</strong>
          {children(person)}
        </li>
      ))}
    </ul>
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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const live = useRef(true);
  const loginLink = useRef<HTMLAnchorElement>(null);
  const focusLogin = useRef(false);
  const confirm = (next: Confirmation) => {
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
    const stop = onPageReturn(() => {
      if (!signedIn()) {
        setData(null);
        setError("ログインし直してください。");
      }
    });
    return () => {
      live.current = false;
      stop();
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
  // While closed, the dialog holds the "remove" wording.
  const copy = confirmations[confirmation?.action ?? "remove"];
  const invite = data && (
    <InviteSection
      invite={data.invite}
      busy={busy}
      run={run}
      onCopied={() => setStatus("コピーしました")}
      onCreate={() =>
        data.invite.expiresAt !== null
          ? confirm({ action: "replace" })
          : void run(create)
      }
    />
  );
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
        <a ref={loginLink} href={LOGIN_HREF}>
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
          {data.requests.length > 0 && (
            <section
              className="account-section account-row"
              aria-labelledby="requests-heading"
            >
              <h2 id="requests-heading">受け取った申請</h2>
              <div>
                <p className="account-hint">
                  承認すると、過去の分も含めてカード・回収した日・枚数が互いに見えます。メモは見えません。
                </p>
                <PersonList people={data.requests}>
                  {(person) => (
                    <>
                      <p>申請日：{friendDate(person.requestedAt)}</p>
                      <div className="account-actions">
                        <button
                          type="button"
                          className="account-primary"
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
                    </>
                  )}
                </PersonList>
              </div>
            </section>
          )}
          {/* With nobody to list yet, inviting someone comes first. */}
          {data.friends.length === 0 && invite}
          <section
            className="account-section account-row"
            aria-labelledby="friends-heading"
          >
            <h2 id="friends-heading">
              フレンド一覧
              {data.friends.length > 0 && (
                <span className="friend-count">{data.friends.length}人</span>
              )}
            </h2>
            <div>
              {data.friends.length === 0 ? (
                <p className="account-empty">フレンドはまだいません。</p>
              ) : (
                <ul className="friend-rows">
                  {data.friends.map((person) => (
                    <li key={person.userId}>
                      <div className="friend-who">
                        <strong>{person.displayName}</strong>
                        <p>
                          {person.count}枚 · フレンドになった日：
                          {friendDate(person.since)}
                        </p>
                      </div>
                      <a
                        className="friend-map-link"
                        href={`/?${new URLSearchParams({ friend: person.userId })}`}
                      >
                        <MapIcon aria-hidden="true" size={18} />
                        回収マップを見る
                      </a>
                      {/* A disclosure, not an ARIA menu: the buttons stay in the tab order. */}
                      <details className="friend-more" name="friend-more">
                        <summary
                          aria-label={`${person.displayName}さんのその他の操作`}
                        >
                          その他
                        </summary>
                        <div className="account-actions">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              confirm({ person, action: "remove" })
                            }
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
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {data.friends.length > 0 && invite}
          <section
            className="account-section account-row"
            aria-labelledby="blocks-heading"
          >
            <h2 id="blocks-heading">ブロック一覧</h2>
            <div>
              <p className="account-hint">
                ブロックを解除してもフレンドには戻りません。もう一度申請が必要です。
              </p>
              {data.blocks.length === 0 ? (
                <p className="account-empty">ブロックしている人はいません。</p>
              ) : (
                <PersonList people={data.blocks}>
                  {(person) => (
                    <>
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
                    </>
                  )}
                </PersonList>
              )}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        title={copy.title(confirmation?.person?.displayName ?? "")}
        confirm={copy.confirm}
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
        <p>{copy.body}</p>
        <p role="alert" className="account-error" hidden={!error}>
          {error}
        </p>
      </ConfirmDialog>
    </>
  );
}
