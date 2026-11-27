import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { areas } from "../../prefectures";
import type { LevelCounts } from "../../domain/map-summary";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import type { MapSurround } from "./map-layout";
import type { MapFocus } from "./map-levels";
import { NATIONAL_OUTLINE } from "./national-outline";
import { measureStage, placeLevel, type StageFrame } from "./level-placement";
import { showStageDiagnostics } from "./stage-diagnostics";
import { useStageGestures, useStagePress } from "./stage-gestures";
import { StageCredit } from "./stage-credit";

/** The list's height, reported as it is laid out and as it changes. */
function useHeight(onHeight?: (height: number) => void) {
  const ref = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !onHeight) return;
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

/**
 * What holds the keyboard on the HTML's drawing of the national level
 * (`first-stage.ts`), as a selector of the stage that replaces it: a
 * choice, or the choices. The rest of the HTML's first view holds no
 * keyboard: its search bar is inert, its button to locate disabled.
 */
function handedFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.closest("[data-first-stage]"))
    return null;
  if (active.dataset.choice) return `[data-choice="${active.dataset.choice}"]`;
  return active.matches(".level-choices") ? ".level-choices" : null;
}

type Placement = ReturnType<typeof placeLevel>;
type Badge = Placement["badges"][number];

type Choice = {
  key: string;
  /** The region or prefecture, for the HTML's script (`first-stage.ts`). */
  id?: string;
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
  /** Where the rows begin; the HTML's script places them (`first-stage.ts`). */
  top?: number;
  onHeight?(height: number): void;
}) {
  const ref = useHeight(onHeight);
  return (
    <ul
      ref={ref}
      className="level-list"
      style={top === undefined ? undefined : { top }}
    >
      {choices.map((choice) => (
        <li key={choice.key}>
          <button
            type="button"
            data-choice={choice.id}
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
 * map opens over the level chosen. A prefecture is drawn on its own once its
 * facilities have come (`pref-stage.tsx`): until then the stage stays on its
 * region and marks the prefecture as the one opening (`status`).
 *
 * A region offers its own prefectures alone. Where their badges and names
 * would lie over each other (a small phone, a phone held sideways), they are
 * listed in rows instead, so that what is read is what a press takes.
 */
export function LevelStage({
  focus,
  openedEarly = false,
  onFocus,
  counts,
  status,
  onWantMap,
  onHold,
  surround,
}: {
  focus: MapFocus;
  /**
   * The level was chosen on the HTML's drawing this stage replaced
   * (`first-stage.ts`): once placed, the keyboard goes on from its choices,
   * as after a choice made here.
   */
  openedEarly?: boolean;
  onFocus(focus: MapFocus): void;
  /**
   * The cards of each level, or null while they are not known: a friend's,
   * or those the records filter, wait for the records. Until then the
   * choices carry their names alone.
   */
  counts: LevelCounts | null;
  /** What the prefecture chosen is waiting for, under the choices. */
  status?: ReactNode;
  /** A drag, a pinch or a wheel: the map that moves is asked for. */
  onWantMap(): void;
  /** A finger is down on the stage: the map does not replace it yet. */
  onHold(held: boolean): void;
  /** The page around the stage, which measures the panels laid over it. */
  surround: MapSurround;
}) {
  const root = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<StageFrame | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    // The observer reports once as it starts, and again when the stage or
    // the page's panels over it change size. Measured from its report and
    // never in this effect: an update made here would run the page's other
    // effects ahead of the screen switch that showed the map. The report
    // comes before the frame it is made for is painted, and is drawn in it:
    // the stage is never painted unplaced, nor a size late, and so replaces
    // the HTML's drawing of it (`first-stage.ts`) without a blank frame.
    const watching = new ResizeObserver(() => {
      const measured = measureStage(element, surround);
      flushSync(() => setFrame(measured));
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
  // The keyboard on the HTML's drawing this stage replaces, read before the
  // first commit takes the drawing away: once this stage is placed (and so
  // can be focused), it goes to the same choice here, or on from the
  // choices of a region chosen there.
  const [handed] = useState(handedFocus);
  const handing = useRef(handed !== null || openedEarly);
  useLayoutEffect(() => {
    if (!frame || !handing.current) return;
    handing.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target =
      (handed && root.current?.querySelector<HTMLElement>(handed)) ||
      (openedEarly ? group.current : null);
    target?.focus({ preventScroll: true });
  }, [frame, handed, openedEarly]);
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

  const placement = placeLevel(frame, focus, counts, listHeight);
  const { badges } = placement;
  const area = areas.find((a) => a.id === focus.area);
  useStageGestures(root, { onWant: onWantMap });
  const pressing = useStagePress(root);
  useEffect(() => {
    onHold(pressing);
  }, [pressing, onHold]);
  useEffect(() => () => onHold(false), [onHold]);
  // What a measurement presses: a badge by its id.
  const placed = useRef(badges);
  useLayoutEffect(() => {
    placed.current = badges;
  });
  useEffect(() => {
    if (!diagnosticsEnabled()) return;
    return showStageDiagnostics({
      view: () => ({ lng: 0, lat: 0, zoom: 0 }),
      tapPoint: (id) => {
        const element = root.current;
        const badge = placed.current.find((badge) => badge.id === id);
        const button = element?.querySelector<HTMLElement>(
          `button[aria-label^="${badge?.name}"]`,
        );
        // Placed once measured; before that it is hidden at the corner.
        if (!element?.hasAttribute("data-measured") || !button) return null;
        const frame = element.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 - frame.left,
          y: rect.top + rect.height / 2 - frame.top,
        };
      },
    });
  }, []);
  return (
    <div
      ref={root}
      className="level-stage"
      data-measured={frame ? "" : undefined}
    >
      {/* A character of a prefecture's name, to measure. */}
      <span className="level-name-size" aria-hidden="true" />
      {placement.land && <StageLand transform={placement.land.transform} />}
      <div
        ref={group}
        role="group"
        tabIndex={-1}
        className="level-choices"
        aria-label={area ? `${area.name}の都道府県を選ぶ` : "地方を選ぶ"}
      >
        {placement.listed ? (
          <LevelList
            top={placement.listTop}
            onHeight={setListHeight}
            choices={choices(placement, focus, onFocus)}
          />
        ) : (
          badges.map((badge) => (
            <LevelBadge
              key={`${badge.kind}:${badge.id}`}
              badge={badge}
              counted={placement.counted}
              current={badge.id === focus.pref}
              placed
              onChoose={() => onFocus(badge.choice)}
            />
          ))
        )}
      </div>
      {focus.pref && status && (
        <div className="level-stage-status" role="status">
          {status}
        </div>
      )}
      <StageCredit />
    </div>
  );
}

/** The coast, placed by `transform` (the HTML's script sets it itself). */
function StageLand({ transform }: { transform?: string }) {
  return (
    <svg className="level-stage-land" aria-hidden="true">
      <path d={NATIONAL_OUTLINE} transform={transform} />
    </svg>
  );
}

/** A level's choices as rows of the list. */
function choices(
  placement: Placement,
  focus: Pick<MapFocus, "pref">,
  onFocus?: (focus: MapFocus) => void,
): Choice[] {
  return placement.badges.map((badge) => ({
    key: `${badge.kind}:${badge.id}`,
    id: badge.id,
    name: badge.name,
    label: badge.label,
    count: placement.counted ? badge.count : null,
    current: badge.id === focus.pref,
    choose: () => onFocus?.(badge.choice),
  }));
}

/** A choice's badge, at its place once the stage is measured. */
function LevelBadge({
  badge,
  counted,
  current,
  placed,
  onChoose,
}: {
  badge: Badge;
  counted: boolean;
  current: boolean;
  /** Placed here; the HTML's script places its own (`first-stage.ts`). */
  placed: boolean;
  onChoose?(): void;
}) {
  return (
    <button
      type="button"
      className="level-badge"
      data-kind={badge.kind}
      data-anchor={badge.labelAnchor}
      data-choice={badge.id}
      aria-label={badge.label}
      aria-current={current ? "true" : undefined}
      style={placed ? badge.style : undefined}
      onClick={onChoose}
    >
      {counted && badge.count}
      <span className="level-badge-name">{badge.name}</span>
    </button>
  );
}

/**
 * The national level as the map's HTML holds it, before any script: the
 * coast, the regions with their public counts, and the outlines' source,
 * none of them placed yet. The script in the HTML places them as this stage
 * would on the screen it finds, before the first paint, and takes the
 * presses until the page's script replaces it with the stage
 * (`first-stage.ts`). The choices are held both as badges and as rows; the
 * script keeps the ones the screen has room for.
 */
export function NationalStageShell({ counts }: { counts: LevelCounts }) {
  const placement = placeLevel(null, { area: null, pref: null }, counts, 0);
  return (
    <div className="level-stage" data-first-stage="">
      <span className="level-name-size" aria-hidden="true" />
      <StageLand />
      <div
        role="group"
        tabIndex={-1}
        className="level-choices"
        aria-label="地方を選ぶ"
      >
        {placement.badges.map((badge) => (
          <LevelBadge
            key={`${badge.kind}:${badge.id}`}
            badge={badge}
            counted
            current={false}
            placed={false}
          />
        ))}
        <LevelList choices={choices(placement, { pref: null })} />
      </div>
      <StageCredit />
    </div>
  );
}
