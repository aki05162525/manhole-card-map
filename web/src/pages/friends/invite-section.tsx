import { useEffect, useState } from "react";
import type { Invite } from "../../features/friends/friends-api";

/** How long the copy button says it has copied. */
const COPIED_FOR = 2000;

/** The invite link, always ready: copy it, share it, or replace it. */
export function InviteSection({
  invite: { url },
  holds,
  busy,
  run,
  onCopied,
  onReplace,
}: {
  invite: Invite;
  /**
   * Whether the link is still the signed-in user's, asked as it is pressed
   * and before it leaves the page: once not, the screen starts again.
   */
  holds(): boolean;
  busy: boolean;
  run(action: () => Promise<void>): Promise<void>;
  onCopied(): void;
  /** Asks before the current link stops working. */
  onReplace(): void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <section
      className="account-section account-row"
      aria-labelledby="invite-heading"
    >
      <h2 id="invite-heading">フレンドを招待</h2>
      <div>
        <p>
          フレンドになると、入手したカードと入手した日を互いに見られます。メモは見えません。
        </p>
        <div className="account-actions">
          <button
            type="button"
            className="account-primary"
            onClick={() => {
              if (!holds()) return;
              void run(async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                onCopied();
              });
            }}
          >
            {copied ? "コピーしました" : "招待リンクをコピー"}
          </button>
          {typeof navigator.share === "function" && (
            <button
              type="button"
              onClick={() => {
                if (!holds()) return;
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
                });
              }}
            >
              共有
            </button>
          )}
        </div>
        <button
          type="button"
          className="account-text-button friend-invite-replace"
          disabled={busy}
          onClick={onReplace}
        >
          リンクを作り直す
        </button>
      </div>
    </section>
  );
}
