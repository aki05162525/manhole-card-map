import { Logo } from "../../shared/ui/logo";
/**
 * Only a failed basemap is told; while it loads the map draws in place. Over
 * the drawing made without the map (`overDrawing`), which stays to be used,
 * it is told under it rather than in its place.
 */
export function MapStatus({
  state,
  friendView = false,
  overDrawing = false,
}: {
  state: string;
  friendView?: boolean;
  overDrawing?: boolean;
}) {
  if (state !== "failed") return null;
  return (
    <div
      className={`map-status map-failure${overDrawing ? " map-failure-under-drawing" : ""}`}
      role="alert"
    >
      <Logo size={48} incomplete />
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
  );
}
