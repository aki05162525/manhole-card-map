import { useEffect, useState } from "react";
import { LoadingLogo } from "../../shared/ui/loading-logo";
import { Logo } from "../../shared/ui/logo";
export function MapStatus({ state }: { state: string }) {
  const [delayed, setDelayed] = useState(false);
  const [exited, setExited] = useState(false);
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setDelayed(true), 300);
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (state !== "ready" || !delayed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setExited(true), 180);
    return () => clearTimeout(timer);
  }, [state, delayed]);
  if (state === "failed")
    return (
      <div className="map-status map-failure" role="alert">
        <Logo size={48} />
        <p>背景地図を読み込めませんでした。検索と一覧は使えます。</p>
        <div className="map-failure-actions">
          <a href="/cards.html">一覧を開く</a>
          <button type="button" onClick={() => location.reload()}>
            再試行
          </button>
        </div>
      </div>
    );
  const ready = state === "ready";
  if (!delayed || (state !== "loading" && !ready) || exited) return null;
  if (ready && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return null;
  return (
    <div
      className={`map-status map-loading ${ready ? "is-ready" : ""}`}
      role={ready ? undefined : "status"}
      aria-hidden={ready || undefined}
    >
      <span className="map-loading-logo">
        <LoadingLogo />
      </span>
      <p>地図を準備しています</p>
    </div>
  );
}
