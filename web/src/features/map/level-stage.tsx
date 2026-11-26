import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { areas } from "../../prefectures";
import type { Pin } from "../../domain/types";
import {
  mapFrame,
  nationalPadding,
  selectionPadding,
  type MapSurround,
} from "./map-layout";
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
import { badgeReach, badgesCrowded, badgesOverlap } from "./stage-layout";

/** What the stage measured of the page around it. */
type Frame = {
  width: number;
  height: number;
  national: ReturnType<typeof nationalPadding>;
  level: ReturnType<typeof selectionPadding>;
  /** A character of a prefecture's name (0.75rem, level-stage.css). */
  nameSize: number;
};

/** A prefecture's badge shrinks below zoom 6, as the map draws it. */
function prefScale(zoom: number) {
  if (zoom >= 6) return 1;
  if (zoom >= 4) return 0.6 + ((zoom - 4) / 2) * 0.4;
  return Math.max(0.25, 0.25 + ((zoom - 2) / 2) * 0.35);
}

/** The list's height, reported as it is laid out and as it changes. */
function useHeight(onHeight: (height: number) => void) {
  const ref = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const report = () => onHeight(element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
  }, [onHeight]);
  return ref;
}

type Choice = {
  key: string;
  name: string;
  label: string;
  count: number | null;
  current: boolean;
  choose(): void;
};

/** A level's choices in rows, where their badges would lie over each other. */
function LevelList({
  choices,
  top,
  onHeight,
}: {
  choices: Choice[];
  top: number;
  onHeight(height: number): void;
}) {
  const ref = useHeight(onHeight);
  return (
    <ul ref={ref} className="level-list" style={{ top }}>
      {choices.map((choice) => (
        <li key={choice.key}>
          <button
            type="button"
            aria-label={choice.label}
            aria-current={choice.current ? "true" : undefined}
            onClick={choice.choose}
          >
            {choice.name}
            {choice.count !== null && (
              <span className="level-list-count">{choice.count}枚</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The levels above the pins, drawn without the map engine: the coast and the
 * counts where the map will draw them, each a button from the first frame.
 * It stands in until the map is handed over and passes each choice on, so the
 * map opens over the level chosen. A prefecture's pins wait for the map: the
 * stage stays on its region and marks the prefecture as the one opening.
 *
 * A region offers its own prefectures alone. Where their badges and names
 * would lie over each other (a small phone, a phone held sideways), they are
 * listed in rows instead, so that what is read is what a press takes.
 */
export function LevelStage({
  focus,
  onFocus,
  countPinsSource,
  counted,
  surround,
}: {
  focus: MapFocus;
  onFocus(focus: MapFocus): void;
  countPinsSource: Pin[];
  /**
   * Whether the counts are known: the pins have arrived, and so have the
   * records that say which of them to count. Until then the choices carry
   * their names alone.
   */
  counted: boolean;
  /** The page around the stage, which measures the panels laid over it. */
  surround: MapSurround;
}) {
  const root = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    // The observer reports once as it starts, before the first paint, and
    // again when the stage or the page's panels over it change size. Measured
    // from its report and never in this effect: an update made here would run
    // the page's other effects ahead of the screen switch that showed the map.
    const watching = new ResizeObserver(() => {
      const measured = mapFrame(element, surround);
      setFrame({
        width: measured.width,
        height: measured.height,
        national: nationalPadding(measured),
        level: selectionPadding(measured),
        nameSize: element.querySelector(".level-name-size")?.clientWidth || 12,
      });
    });
    observer.current = watching;
    watching.observe(element);
    for (const target of surround.watched(element)) watching.observe(target);
    return () => {
      observer.current = null;
      watching.disconnect();
      // The frame survives either outcome, including disposal of a failed canvas.
      if (element.contains(document.activeElement))
        element.parentElement?.focus({ preventScroll: true });
    };
  }, [surround]);
  // A chosen level can add a panel over the stage, watched from the commit
  // that adds it; it is let go with the observer.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    for (const target of surround.watchedForLevel(element))
      observer.current?.observe(target);
  }, [focus.area, surround]);
  // A choice takes its own button away (a region's badge, the trail's way
  // back): the keyboard goes on from the choices that replaced it.
  const level = useRef(focus.area);
  useEffect(() => {
    if (level.current === focus.area) return;
    level.current = focus.area;
    const active = document.activeElement;
    if (!active || active === document.body)
      group.current?.focus({ preventScroll: true });
  }, [focus.area]);

  const counts = useMemo(() => countPins(countPinsSource), [countPinsSource]);
  const shown = { area: focus.area, pref: null };
  const view = focusCamera(shown);
  const padding = focus.area === null ? frame?.national : frame?.level;
  const camera =
    frame && padding
      ? stageCamera(frame.width, frame.height, { ...view, padding })
      : null;
  const zoom = camera?.zoom ?? 0;
  const badges = countsForMap(
    zoom,
    shown,
    counts,
    frame?.width ?? Infinity,
  ).features.flatMap(({ geometry, properties: p }) => {
    // The map also draws the neighbours' badges at this scale. They are
    // other regions' choices, and some lie beyond the screen's edge.
    if (focus.area !== null && p.kind !== "pref") return [];
    const choice =
      p.kind === "area" ? focusForAreaTap(p.id) : focusForPrefTap(p.id);
    if (focus.area !== null && choice.area !== focus.area) return [];
    const [lng, lat] = geometry.coordinates;
    return [
      {
        ...p,
        x: camera?.x(lng) ?? 0,
        y: camera?.y(lat) ?? 0,
        radius: p.radius * (p.kind === "area" ? 1 : prefScale(zoom)),
        label: counted ? `${p.name} ${p.count}枚` : p.name,
        choose: () => onFocus(choice),
      },
    ];
  });
  const listed = badges.some((badge) => badge.kind === "pref")
    ? badgesCrowded(badges, frame?.nameSize ?? 12)
    : badgesOverlap(badges);
  const reach = listed ? [] : badgeReach(badges);
  // The coast below the rows, as far as the screen has room.
  const land =
    frame && padding && listed
      ? stageCamera(frame.width, frame.height, {
          ...view,
          padding: {
            ...padding,
            top: Math.min(
              padding.top + listHeight,
              Math.max(padding.top, frame.height - padding.bottom - 120),
            ),
          },
        })
      : camera;
  const area = areas.find((a) => a.id === focus.area);
  return (
    <div
      ref={root}
      className="level-stage"
      data-measured={frame ? "" : undefined}
    >
      {/* A character of a prefecture's name, to measure. */}
      <span className="level-name-size" aria-hidden="true" />
      {land && (
        <svg className="level-stage-land" aria-hidden="true">
          <path
            d={NATIONAL_OUTLINE}
            transform={`translate(${land.x(OUTLINE_ORIGIN.west)} ${land.y(OUTLINE_ORIGIN.north)}) scale(${land.scale * OUTLINE_ORIGIN.unit})`}
          />
        </svg>
      )}
      <div
        ref={group}
        role="group"
        tabIndex={-1}
        className="level-choices"
        aria-label={area ? `${area.name}の都道府県を選ぶ` : "地方を選ぶ"}
      >
        {listed ? (
          <LevelList
            // 8px under the search bar, 12px under the trail.
            top={(padding?.top ?? 0) - (focus.area === null ? 0 : 8)}
            onHeight={setListHeight}
            choices={badges.map((badge) => ({
              key: `${badge.kind}:${badge.id}`,
              name: badge.name,
              label: badge.label,
              count: counted ? badge.count : null,
              current: badge.id === focus.pref,
              choose: badge.choose,
            }))}
          />
        ) : (
          badges.map((badge, i) => (
            <button
              key={`${badge.kind}:${badge.id}`}
              type="button"
              className="level-badge"
              data-kind={badge.kind}
              data-anchor={badge.labelAnchor}
              aria-label={badge.label}
              aria-current={badge.id === focus.pref ? "true" : undefined}
              style={
                {
                  left: badge.x,
                  top: badge.y,
                  "--badge-radius": `${badge.radius}px`,
                  "--badge-reach": `${reach[i]}px`,
                  "--badge-value": `${badge.valueSize}px`,
                } as CSSProperties
              }
              onClick={badge.choose}
            >
              {counted && badge.count}
              <span className="level-badge-name">{badge.name}</span>
            </button>
          ))
        )}
      </div>
      {focus.pref && (
        <p className="level-stage-status" role="status">
          {focus.pref}の地図を読み込んでいます
        </p>
      )}
    </div>
  );
}
