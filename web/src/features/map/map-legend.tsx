import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useMap } from "../../components/ui/map";
import { labels } from "../../shared/ui/labels";
import { mapPalette } from "./map-theme";
import type { Status } from "../../domain/types";
import "./map-legend.css";

function Symbol({
  status,
}: {
  status: Status | "reference" | "place" | "lid";
}) {
  const light = mapPalette(false),
    dark = mapPalette(true);
  const color = (palette: ReturnType<typeof mapPalette>) =>
    status === "place" || status === "lid"
      ? palette.ink
      : status === "reference"
        ? palette.reference
        : palette.pins[status];
  const hollow =
    status === "ended" || status === "unknown" || status === "reference";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      style={
        {
          "--symbol-light": color(light),
          "--symbol-dark": color(dark),
        } as CSSProperties
      }
    >
      {status === "lid" ? (
        <circle cx="8" cy="8" r="7" fill="currentColor" />
      ) : (
        <>
          <path
            d={
              status === "reference"
                ? "M6 1H1V6M10 1H15V6M1 10V15H6M10 15H15V10"
                : "M1 1H15V15H1Z"
            }
            fill={hollow || status === "suspended" ? "none" : "currentColor"}
            stroke="currentColor"
            strokeWidth="2"
          />
          {status === "suspended" && (
            <path d="M2 2H8V14H2Z" fill="currentColor" />
          )}
        </>
      )}
    </svg>
  );
}

/** Mount beside MapLibre's inner attribution, which it replaces on source changes. */
export function MapLegend() {
  const { map, isLoaded } = useMap();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!map || !isLoaded) return;
    const attribution = map
      .getContainer()
      .querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
    if (!attribution) return;
    const host = document.createElement("div");
    host.className = "map-attribution-legend";
    attribution.append(host);
    setTarget(host);
    return () => {
      host.remove();
      setTarget(null);
    };
  }, [map, isLoaded]);
  return target
    ? createPortal(
        <section className="pin-legend" aria-label="地図の凡例">
          <div className="pin-legend-kinds">
            <span>
              <Symbol status="place" />
              配布場所
            </span>
            <span>
              <Symbol status="lid" />蓋
            </span>
          </div>
          <div className="pin-legend-states">
            {(Object.keys(labels) as Status[]).map((status) => (
              <span key={status}>
                <Symbol status={status} />
                {labels[status]}
              </span>
            ))}
            <span>
              <Symbol status="reference" />
              参考位置
            </span>
          </div>
        </section>,
        target,
      )
    : null;
}
