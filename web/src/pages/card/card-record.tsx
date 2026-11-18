import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  preloadRecords,
  RecordEditor,
  RecordsBoundary,
  RecordsHost,
} from "../../features/records/records-entry";
import { useRecords } from "../../features/records/records-context";
import { accountHref } from "../../session/account-url";

/**
 * The visitor's own record of one card, on that card's generated page. The
 * page's text is the build's and stays as it is; this is the only part drawn
 * in the browser, and only for a visitor with a session.
 */
function CardRecord({ cardId }: { cardId: string }) {
  const { phase, notification } = useRecords();
  // The session ended here or in another tab: the link the page was built with.
  if (phase === "signed-out")
    return <a href={accountHref(location.pathname)}>ログインして入手を記録</a>;
  return (
    <>
      {notification && (
        <p className="record-notice" role="alert">
          {notification}
        </p>
      )}
      {phase === "ready" ? (
        <RecordEditor cardId={cardId} />
      ) : (
        <p className="record-notice" role="status">
          {phase === "failed"
            ? "記録を読み込めませんでした"
            : "記録を読み込み中…"}
        </p>
      )}
    </>
  );
}

/** `root` is the page's `#card-record`; its sign-in link gives way. */
export async function mountCardRecord(root: HTMLElement) {
  const cardId = root.dataset.cardId;
  if (!cardId) return;
  // As on the list: loaded first, the feature cannot suspend the first render
  // and empty the place for a frame.
  await preloadRecords().catch(() => undefined);
  let aliases: Record<string, string> | undefined;
  try {
    aliases = JSON.parse(root.dataset.cardAliases ?? "null") ?? undefined;
  } catch {
    // The earlier numbers are the build's; without them the card's own counts.
  }
  createRoot(root).render(
    <StrictMode>
      <RecordsHost>
        <RecordsBoundary ready aliases={aliases}>
          <CardRecord cardId={cardId} />
        </RecordsBoundary>
      </RecordsHost>
    </StrictMode>,
  );
}
