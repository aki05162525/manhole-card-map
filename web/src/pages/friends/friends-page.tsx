import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Map as MapIcon } from "lucide-react";
import { SiteHeader } from "../../shared/ui/site-header";
import { SealMark } from "../../shared/ui/seal";
import { signedIn } from "../../session/signed-in";
import { ApiError } from "../../session/api";
import { Dropped } from "../../session/session-guard";
import {
  useOnUser,
  usePrivateApi,
  type Operation,
} from "../../session/account-api";
import type { Owner } from "../../session/session-guard";
import { amend, readPrivate, remembered } from "../../session/private-reads";
import { Delayed } from "../../shared/ui/delayed";
import { ConfirmDialog } from "../../shared/ui/confirm-dialog";
import { friendError, friendDate } from "../../features/friends/friends-api";
import {
  friendsRead,
  isInvite,
  type FriendsPage,
  type Person,
} from "../../contract/private-api";
import { InviteSection } from "./invite-section";

const LOGIN_HREF = "/account?returnTo=%2Ffriends";

// Asked as the lists' owner (`owner`): it names the other person.
type Confirmation = {
  person?: Person;
  action: "remove" | "replace";
  owner: Owner;
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
  remove: {
    title: (name) => `${name}とのフレンドを解除しますか？`,
    confirm: "解除する",
    body: "お互いの入手記録が見られなくなります。",
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
          <p>現在、フレンド機能は利用できません。</p>
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
          <strong>
            <SealMark seal={person.seal} name={person.displayName} />
            {person.displayName}
          </strong>
          {children(person)}
        </li>
      ))}
    </ul>
  );
}

function Friends() {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // Every request is this user's (`usePrivateApi`).
  const session = usePrivateApi();
  // The lists shown, and the owner they were read as: drawn only while the
  // screen still holds it (`shows`), and the invitation's link leaves the
  // page only then (`holds`). Those read before for this user are drawn at
  // once and read again.
  const [data, setData] = useState<(FriendsPage & { owner: Owner }) | null>(
    () => {
      const kept = remembered(friendsRead);
      return kept && { ...kept, owner: session.owner };
    },
  );
  const loginLink = useRef<HTMLAnchorElement>(null);
  const focusLogin = useRef(false);
  // Asked as the owner of the lists pressed in, once the cookies still
  // name them; otherwise the screen starts again.
  const confirm = (next: Omit<Confirmation, "owner">) => {
    if (!data || !session.holds(data.owner)) return;
    setError("");
    setConfirmation({ ...next, owner: data.owner });
  };
  const shown = data && session.shows(data.owner) ? data : null;
  const asked =
    confirmation && session.shows(confirmation.owner) ? confirmation : null;
  useEffect(() => {
    // The child dialog has closed and released inert before this effect runs.
    if (focusLogin.current && confirmation === null) {
      loginLink.current?.focus();
      focusLogin.current = false;
    }
  }, [confirmation, error]);
  // One request: the session and all four parts are read together. On
  // entering, a read started ahead of the screen counts as this one.
  const load = async (
    operation: Operation = session.operation(),
    { fresh = true } = {},
  ) => {
    const page = await readPrivate(operation, friendsRead, { fresh });
    if (session.holds(operation.owner))
      setData({ ...page, owner: operation.owner });
  };
  const fail = (cause: unknown) => {
    if (cause instanceof Dropped) return;
    setError(friendError(cause));
    if (!signedIn()) {
      focusLogin.current = true;
      setConfirmation(null);
      setData(null);
    }
  };
  // Another user now, the lists of the one before go and the new user's
  // are read; signed out, it is the end of the session, as a 401 is.
  useOnUser(session, () => {
    if (!signedIn()) return fail(new ApiError(401, "unauthorized"));
    setData(null);
    setConfirmation(null);
    setError("");
    void load().catch(fail);
  });
  const start = useEffectEvent(
    () => void load(session.operation(), { fresh: false }).catch(fail),
  );
  useEffect(() => {
    // The initial read updates state only after its promise settles.
    // oxlint-disable-next-line react/set-state-in-effect
    start();
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
      setBusy(false);
    }
  }
  async function replace() {
    const operation = session.operation();
    const invite = await operation.api("/api/invite", {
      method: "POST",
      read: isInvite,
    });
    const { owner } = operation;
    // A return to this screen draws the kept read first: the new link.
    if (amend(session, owner, friendsRead, (page) => ({ ...page, invite }))) {
      setData((previous) =>
        previous && previous.owner === owner
          ? { ...previous, invite }
          : previous,
      );
      setConfirmation(null);
    }
  }
  async function change(path: string, method: string) {
    const operation = session.operation();
    await operation.api(path, { method });
    // Remove stale private rows even if the subsequent refresh fails.
    if (session.holds(operation.owner)) {
      setData(null);
      setConfirmation(null);
    }
    await load(operation);
  }
  const personPath = (prefix: string, person: Person) =>
    `${prefix}/${encodeURIComponent(person.userId)}`;
  // While closed, the dialog holds the "remove" wording.
  const copy = confirmations[asked?.action ?? "remove"];
  const invite = shown && (
    <InviteSection
      invite={shown.invite}
      holds={() => session.holds(shown.owner)}
      busy={busy}
      run={run}
      onCopied={() => setStatus("コピーしました")}
      onReplace={() => confirm({ action: "replace" })}
    />
  );
  return (
    <>
      {error && asked === null && (
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
      ) : !shown ? (
        <>
          {error ? (
            <p>フレンド情報を読み込めませんでした。</p>
          ) : (
            <Delayed>
              <p>読み込み中…</p>
            </Delayed>
          )}
          {error && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => load())}
            >
              再読み込み
            </button>
          )}
        </>
      ) : (
        <>
          {shown.requests.length > 0 && (
            <section
              className="account-section account-row"
              aria-labelledby="requests-heading"
            >
              <h2 id="requests-heading">受け取った申請</h2>
              <div>
                <p className="account-hint">
                  承認すると、過去の分も含めて入手したカード・日付・枚数がお互いに見えるようになります。メモは表示されません。
                </p>
                <PersonList people={shown.requests}>
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
                      </div>
                    </>
                  )}
                </PersonList>
              </div>
            </section>
          )}
          {/* With nobody to list yet, inviting someone comes first. */}
          {shown.friends.length === 0 && invite}
          <section
            className="account-section account-row"
            aria-labelledby="friends-heading"
          >
            <h2 id="friends-heading">
              フレンド一覧
              {shown.friends.length > 0 && (
                <span className="friend-count">{shown.friends.length}人</span>
              )}
            </h2>
            <div>
              {shown.friends.length === 0 ? (
                <p className="account-empty">フレンドはまだいません。</p>
              ) : (
                <ul className="friend-rows">
                  {shown.friends.map((person) => (
                    <li key={person.userId}>
                      <div className="friend-who">
                        <SealMark
                          seal={person.seal}
                          name={person.displayName}
                        />
                        <strong>{person.displayName}</strong>
                        <p>{person.count}枚</p>
                      </div>
                      <a
                        className="friend-map-link"
                        href={`/?${new URLSearchParams({ friend: person.userId })}`}
                      >
                        <MapIcon aria-hidden="true" size={18} />
                        入手マップを見る
                      </a>
                      {/* A disclosure, not an ARIA menu: the buttons stay in the tab order. */}
                      <details className="friend-more" name="friend-more">
                        <summary
                          aria-label={`${person.displayName}のその他の操作`}
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
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {shown.friends.length > 0 && invite}
          {shown.blocks.length > 0 && (
            <section
              className="account-section account-row"
              aria-labelledby="blocks-heading"
            >
              <h2 id="blocks-heading">ブロック一覧</h2>
              <div>
                <p className="account-hint">
                  ブロックを解除してもフレンドには戻りません。もう一度申請が必要です。
                </p>
                <PersonList people={shown.blocks}>
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
              </div>
            </section>
          )}
        </>
      )}
      <ConfirmDialog
        open={asked !== null}
        title={copy.title(asked?.person?.displayName ?? "")}
        confirm={copy.confirm}
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation || !session.holds(confirmation.owner)) return;
          const { action, person } = confirmation;
          void run(() =>
            action === "replace"
              ? replace()
              : change(personPath("/api/friends", person!), "DELETE"),
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
