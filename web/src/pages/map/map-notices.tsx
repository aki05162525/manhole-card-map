import { DataErrorBanner } from "../../shared/ui/data-error-banner";
import { useEffect, useState, type ReactNode } from "react";
import type { useDetailSelection } from "./use-detail-selection";
import { LocationHelp } from "./location-help";
export function MapNotices({
  friendView = false,
  fixture,
  issues,
  closeCard,
  dataError,
  message,
  locationDenied = false,
  dismissMessage,
  asOf,
  recordsControl,
  mapFailed = false,
}: {
  friendView?: boolean;
  fixture: boolean;
  issues: ReturnType<typeof useDetailSelection>["issues"];
  closeCard: () => void;
  dataError?: string;
  message: string;
  locationDenied?: boolean;
  dismissMessage?: () => void;
  asOf?: string | undefined;
  recordsControl?: ReactNode;
  /**
   * The basemap could not be read. The drawing before the map stays to be
   * used, and the search and the list with it.
   */
  mapFailed?: boolean;
}) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const online = () => setOffline(false);
    const offline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  if (
    !fixture &&
    !issues.length &&
    !dataError &&
    !message &&
    !offline &&
    !recordsControl &&
    !mapFailed
  )
    return <div className="map-notices" hidden />;
  return (
    <div className="map-notices">
      {recordsControl}
      {fixture && (
        <p className="fixture-warning" role="status">
          検証用の架空データです。実際の訪問先として使わないでください。
        </p>
      )}
      {issues.length > 0 && (
        <div className="map-notice" role="alert">
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
          <button type="button" onClick={closeCard}>
            カード指定を解除
          </button>
        </div>
      )}
      {mapFailed && (
        <div className="map-notice" role="alert">
          <p>
            背景地図を読み込めませんでした。
            {!friendView && "検索と一覧は使えます。"}
          </p>
          <div className="map-failure-actions">
            {!friendView && <a href="/cards">一覧を開く</a>}
            <button type="button" onClick={() => location.reload()}>
              再試行
            </button>
          </div>
        </div>
      )}
      {dataError && (
        <DataErrorBanner
          message={
            friendView
              ? "地図のピンを読み込めませんでした。再読み込みしてください。"
              : "地図のピンを読み込めませんでした。検索と一覧は使えます。再読み込みしてください。"
          }
          onReload={() => location.reload()}
        />
      )}
      {offline && (
        <p className="map-notice" role="status">
          {asOf ? (
            <>
              オフラインです。基準日{" "}
              <time className="map-notice-date" dateTime={asOf.slice(0, 10)}>
                {asOf.slice(0, 10)}
              </time>{" "}
              時点の情報を表示しています
            </>
          ) : (
            "オフラインです。カード情報はまだ読み込まれていません。"
          )}
        </p>
      )}
      {message && (
        <div className="map-notice" role="status">
          <p>{message}</p>
          {locationDenied && <LocationHelp />}
          {dismissMessage && (
            <button
              type="button"
              className="map-notice-close"
              onClick={dismissMessage}
            >
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
