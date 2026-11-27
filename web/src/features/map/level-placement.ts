import type { LevelCounts } from "../../domain/map-summary";
import {
  mapFrame,
  nationalPadding,
  selectionPadding,
  type MapSurround,
} from "./map-layout";
import {
  areaBordersEmphasized,
  countsForMap,
  focusCamera,
  focusForAreaTap,
  focusForPrefTap,
  type MapFocus,
} from "./map-levels";
import { OUTLINE_ORIGIN } from "./national-outline";
import { stageCamera } from "./stage-camera";
import { badgeReach, badgesCrowded, badgesOverlap } from "./stage-layout";

// Where the drawing of the levels puts the coast and each choice. The
// stage draws with it (`level-stage.tsx`), and so does the script in the
// map's HTML before the page's own script has loaded (`map-stage-main.ts`):
// the one replaces the other in place.

/** What the stage measured of the page around it. */
export type StageFrame = {
  width: number;
  height: number;
  national: ReturnType<typeof nationalPadding>;
  level: ReturnType<typeof selectionPadding>;
  /** A character of a prefecture's name (0.75rem, level-stage.css). */
  nameSize: number;
};

/** Measures the stage `element` and the panels the page lays over it. */
export function measureStage(
  element: Element,
  surround: MapSurround,
): StageFrame {
  const measured = mapFrame(element, surround);
  return {
    width: measured.width,
    height: measured.height,
    national: nationalPadding(measured),
    level: selectionPadding(measured),
    nameSize: element.querySelector(".level-name-size")?.clientWidth || 12,
  };
}

const EMPTY: LevelCounts = { prefs: {}, areas: {} };

/** A prefecture's badge shrinks below zoom 6, as the map draws it. */
function prefScale(zoom: number) {
  if (zoom >= 6) return 1;
  if (zoom >= 4) return 0.6 + ((zoom - 4) / 2) * 0.4;
  return Math.max(0.25, 0.25 + ((zoom - 2) / 2) * 0.35);
}

/** The camera the level `shown` opens at on `frame`, once measured. */
function levelCamera(frame: StageFrame | null, shown: MapFocus) {
  const view = focusCamera(shown);
  const padding = shown.area === null ? frame?.national : frame?.level;
  const camera =
    frame && padding
      ? stageCamera(frame.width, frame.height, { ...view, padding })
      : null;
  return { view, padding, camera };
}

/**
 * Whether the national level opens close enough on `frame` for the
 * prefectures' badges, in place of the regions' (a screen of some 4,000px
 * across). The HTML's script leaves such a screen to the stage, and never
 * places a prefecture (`first-stage.ts`).
 */
export function nationalShowsPrefectures(frame: StageFrame) {
  const national = { area: null, pref: null };
  const { camera } = levelCamera(frame, national);
  return !areaBordersEmphasized(camera?.zoom ?? 0, national);
}

/**
 * The level's choices where the stage draws them, the coast under them,
 * and whether they are listed in rows instead (where their badges would lie
 * over each other). `listHeight` is the rows' height once laid out: the
 * coast is drawn below them. Before the stage is measured (`frame` null)
 * nothing has a place yet.
 */
export function placeLevel(
  frame: StageFrame | null,
  focus: Pick<MapFocus, "area" | "pref">,
  counts: LevelCounts | null,
  listHeight: number,
) {
  const counted = counts !== null;
  const known = counts ?? EMPTY;
  const shown = { area: focus.area, pref: null };
  const { view, padding, camera } = levelCamera(frame, shown);
  const zoom = camera?.zoom ?? 0;
  const badges = countsForMap(
    zoom,
    shown,
    known,
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
        choice,
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
  return {
    counted,
    badges: badges.map((badge, i) => ({
      ...badge,
      /** How it is placed: by its centre, its size and its reach. */
      style: {
        left: `${badge.x}px`,
        top: `${badge.y}px`,
        "--badge-radius": `${badge.radius}px`,
        "--badge-reach": `${reach[i]}px`,
        "--badge-value": `${badge.valueSize}px`,
      },
    })),
    listed,
    // 8px under the search bar, 12px under the trail.
    listTop: (padding?.top ?? 0) - (focus.area === null ? 0 : 8),
    /** The coast's path placed on the screen, once the stage is measured. */
    land: land && {
      transform: `translate(${land.x(OUTLINE_ORIGIN.west)} ${land.y(OUTLINE_ORIGIN.north)}) scale(${land.scale * OUTLINE_ORIGIN.unit})`,
    },
  };
}
