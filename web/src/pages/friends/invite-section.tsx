import { japanFormat } from "../../shared/universal/japan-time";
import { friendDate, type Invite } from "../../features/friends/friends-api";

const inviteTime = /* @__PURE__ */ japanFormat({
  hour: "2-digit",
  minute: "2-digit",
});

/** The invite link: what it shares, the link while it can be shown, and its actions. */
export function InviteSection({
  invite: { url, expiresAt },
  busy,
  run,
  onCopied,
  onCreate,
}: {
  invite: Invite;
  busy: boolean;
  run(action: () => Promise<void>): Promise<void>;
  onCopied(): void;
  /** Creates the first link, or asks before replacing the current one. */
  onCreate(): void;
}) {
  return (
    <section
      className="account-section account-row"
      aria-labelledby="invite-heading"
    >
      <h2 id="invite-heading">招待リンク</h2>
      <div>
        <p>
          リンクを送った相手が申請し、あなたが承認するとフレンドになります。
        </p>
        <dl className="friend-facts">
          <div>
            <dt>見えるもの</dt>
            <dd>表示名、回収済みのカード、回収した日、枚数</dd>
          </div>
          <div>
            <dt>見えないもの</dt>
            <dd>メモ</dd>
          </div>
        </dl>
        {url ? (
          <>
            <label className="friend-invite-label" htmlFor="invite-url">
              送るリンク
            </label>
            <input
              id="invite-url"
              className="friend-invite-url"
              type="text"
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
            />
          </>
        ) : (
          expiresAt !== null && (
            <p>
              前に作ったリンクは再表示できません。必要なら作り直してください。
            </p>
          )
        )}
        {expiresAt !== null && (
          <p className="account-hint">
            期限：
            <time dateTime={new Date(expiresAt).toISOString()}>
              {friendDate(expiresAt)} {inviteTime.format(expiresAt)}
              （日本時間）
            </time>
          </p>
        )}
        <div className="account-actions">
          {url && (
            <button
              type="button"
              className="account-primary"
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(url);
                  onCopied();
                })
              }
            >
              コピー
            </button>
          )}
          {url && typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  try {
                    await navigator.share({
                      url,
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
          <button type="button" disabled={busy} onClick={onCreate}>
            {expiresAt !== null ? "作り直す" : "招待リンクを作る"}
          </button>
        </div>
        <p className="account-hint">
          作り直すと、前の招待リンクは使えなくなります。
        </p>
      </div>
    </section>
  );
}
