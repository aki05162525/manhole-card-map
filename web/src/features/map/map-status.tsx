import { useEffect, useState } from "react";
import { Logo } from "../../shared/ui/logo";
export function MapStatus({ state }: { state: string }) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setDelayed(true), 300);
    return () => clearTimeout(timer);
  }, [state]);
  if (state === "failed")
    return (
      <div className="map-status map-failure" role="alert">
        <p>背景地図を読み込めませんでした。検索と一覧は使えます。</p>
        <button type="button" onClick={() => location.reload()}>
          再試行
        </button>
      </div>
    );
  if (state !== "loading" || !delayed) return null;
  return (
    <div className="map-status map-loading" role="status">
      <span className="map-loading-logo">
        <Logo size={48} />
      </span>
      <p>地図を準備しています</p>
    </div>
  );
}
