import type { useDetailSelection } from "./use-detail-selection";
export function MapNotices({
  fixture,
  issues,
  closeCard,
  dataError,
  message,
  mapState,
}: {
  fixture: boolean;
  issues: ReturnType<typeof useDetailSelection>["issues"];
  closeCard: () => void;
  dataError?: string;
  message: string;
  mapState: string;
}) {
  return (
    <div className="map-notices">
      {fixture && (
        <p className="fixture-warning" role="status">
          検証用の架空データです。実在する訪問先の情報として使わないでください。
        </p>
      )}
      {issues.length > 0 && (
        <div role="alert">
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
          <button onClick={closeCard}>カード指定を解除</button>
        </div>
      )}
      {(dataError || message || mapState === "failed") && (
        <p className="map-notice" role="status">
          {dataError || message || "背景地図を読み込めませんでした。"}
        </p>
      )}
    </div>
  );
}
