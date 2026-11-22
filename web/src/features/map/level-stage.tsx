import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Pin } from "../../domain/types";
import { nationalPadding, selectionPadding } from "./map-layout";
import {
  countPins,
  countsForMap,
  focusCamera,
  focusForAreaTap,
  focusForPrefTap,
  type MapFocus,
} from "./map-levels";
import { NATIONAL_OUTLINE, OUTLINE_ORIGIN } from "./national-outline";
import { stageCamera } from "./stage-camera";

/** What the stage measured of the page around it. */
type Frame = {
  width: number;
  height: number;
  national: ReturnType<typeof nationalPadding>;
  level: ReturnType<typeof selectionPadding>;
};

/** A prefecture's badge shrinks below zoom 6, as the map draws it. */
function prefScale(zoom: number) {
  if (zoom >= 6) return 1;
  if (zoom >= 4) return 0.6 + ((zoom - 4) / 2) * 0.4;
  return Math.max(0.25, 0.25 + ((zoom - 2) / 2) * 0.35);
}

/**
 * The levels above the pins, drawn without the map engine: the coast and the
 * counts where the map will draw them, each a button from the first frame.
 * It stands in until the map is ready and passes each choice on, so the map
 * opens over the level chosen. A prefecture's pins wait for the map: the
 * stage stays on its region and marks the prefecture as the one opening.
 */
export function LevelStage({
  focus,
  onFocus,
  countPinsSource,
  pinsLoaded,
}: {
  focus: MapFocus;
  onFocus(focus: MapFocus): void;
  countPinsSource: Pin[];
  /** Until then the badges carry no counts. */
  pinsLoaded: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setFrame({
        width,
        height,
        national: nationalPadding(element),
        level: selectionPadding(element),
      });
    };
    // Reported before the first paint, and again when the stage or the
    // row above it (the trail a chosen region adds) changes size.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const trail = element.closest(".explorer")?.querySelector(".map-top");
    if (trail) observer.observe(trail);
    return () => observer.disconnect();
  }, []);
  const counts = useMemo(() => countPins(countPinsSource), [countPinsSource]);
  const shown = { area: focus.area, pref: null };
  const camera = frame
    ? stageCamera(frame.width, frame.height, {
        ...focusCamera(shown),
        padding: focus.area === null ? frame.national : frame.level,
      })
    : null;
  const zoom = camera?.zoom ?? 0;
  const badges = countsForMap(zoom, shown, counts, frame?.width ?? Infinity);
  return (
    <div ref={root} className="level-stage">
      {camera && (
        <svg className="level-stage-land" aria-hidden="true">
          <path
            d={NATIONAL_OUTLINE}
            transform={`translate(${camera.x(OUTLINE_ORIGIN.west)} ${camera.y(OUTLINE_ORIGIN.north)}) scale(${camera.scale * OUTLINE_ORIGIN.unit})`}
          />
        </svg>
      )}
      <div
        role="group"
        aria-label={focus.area === null ? "地方を選ぶ" : "都道府県を選ぶ"}
      >
        {badges.features.map(({ geometry, properties: p }) => {
          const radius = p.radius * (p.kind === "area" ? 1 : prefScale(zoom));
          const [lng, lat] = geometry.coordinates;
          return (
            <button
              key={`${p.kind}:${p.id}`}
              type="button"
              className="level-badge"
              data-kind={p.kind}
              data-anchor={p.labelAnchor}
              aria-label={pinsLoaded ? `${p.name} ${p.count}枚` : p.name}
              aria-current={p.id === focus.pref ? "true" : undefined}
              style={
                {
                  left: camera?.x(lng),
                  top: camera?.y(lat),
                  "--badge-radius": `${radius}px`,
                  "--badge-value": `${p.valueSize}px`,
                } as CSSProperties
              }
              onClick={() =>
                onFocus(
                  p.kind === "area"
                    ? focusForAreaTap(p.id)
                    : focusForPrefTap(p.id),
                )
              }
            >
              {pinsLoaded && p.count}
              <span className="level-badge-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      {focus.pref && (
        <p className="level-stage-status" role="status">
          {focus.pref}の地図を読み込んでいます
        </p>
      )}
    </div>
  );
}
