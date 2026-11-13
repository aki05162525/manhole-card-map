import { Logo } from "../../shared/ui/logo";
/** Only a failed basemap covers the stage; while it loads the map draws in place. */
export function MapStatus({ state }: { state: string }) {
  if (state !== "failed") return null;
  return (
    <div className="map-status map-failure" role="alert">
      <Logo size={48} incomplete />
      <p>背景地図を読み込めませんでした。検索と一覧は使えます。</p>
      <div className="map-failure-actions">
        <a href="/cards">一覧を開く</a>
        <button type="button" onClick={() => location.reload()}>
          再試行
        </button>
      </div>
    </div>
  );
}
