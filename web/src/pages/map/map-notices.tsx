import { useEffect, useState } from "react";
import type { useDetailSelection } from "./use-detail-selection";
export function MapNotices({
  fixture,
  issues,
  closeCard,
  dataError,
  message,
  asOf,
}: {
  fixture: boolean;
  issues: ReturnType<typeof useDetailSelection>["issues"];
  closeCard: () => void;
  dataError?: string;
  message: string;
  asOf?: string;
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
  if (!fixture && !issues.length && !dataError && !message && !offline)
    return null;
  return (
    <div className="map-notices">
      {fixture && (
        <p className="fixture-warning" role="status">
          検証用の架空データです。実在する訪問先の情報として使わないでください。
        </p>
      )}
      {issues.length > 0 && (
        <div className="map-notice" role="alert">
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
          <button onClick={closeCard}>カード指定を解除</button>
        </div>
      )}
      {dataError && (
        <div className="map-notice map-notice-error" role="alert">
          <p>
            カード情報を読み込めませんでした。検索と一覧も使えません。再読み込みしてください。
          </p>
          <button type="button" onClick={() => location.reload()}>
            再読み込み
          </button>
        </div>
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
        <p className="map-notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
