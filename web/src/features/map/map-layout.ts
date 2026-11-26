import { nationalCameraPadding } from "./area-layout";
import { paddingForSelection } from "./selection-padding";
import { focusCamera, type MapFocus } from "./map-levels";

/**
 * What the page lays over a map, as the page measured it: edges in px from
 * the map's top-left corner, and the height of the sheet that shows.
 */
type MapCover = {
  /** The bottom edge of the search bar, if the page has one. */
  bar?: number | undefined;
  /** The bottom edge of the notices (0 without any). */
  notices: number;
  /** The bottom edge of the trail of levels (0 without one). */
  trail: number;
  /** The right edge of the detail panel, if one is open. */
  panel?: number | undefined;
  /** How much of the bottom sheet shows. */
  sheet: number;
  /** The top edge of the locate button. */
  locate?: number | undefined;
};

/** The page around a map, which measures what covers it. */
export type MapSurround = {
  /** What covers `map`, laid out at `bounds`. */
  cover(map: Element, bounds: DOMRectReadOnly): MapCover;
  /** The page's elements whose size changes the cover. */
  watched(map: Element): Element[];
  /** Those that come with a level, watched again as the level changes. */
  watchedForLevel(map: Element): Element[];
};

/** A map's size, and what covers it. */
type Frame = { width: number; height: number; cover: MapCover };

/** Measures what the page lays over `map` now. */
export function mapFrame(map: Element, surround: MapSurround): Frame {
  const bounds = map.getBoundingClientRect();
  return {
    width: bounds.width,
    height: bounds.height,
    cover: surround.cover(map, bounds),
  };
}

export function selectionPadding({ width, height, cover }: Frame, count = 0) {
  return paddingForSelection({
    width,
    height,
    // The breadcrumbs: under the bar and the notices, or beside them.
    top: Math.max(cover.bar ?? 0, cover.notices, cover.trail),
    sheetHeight: cover.sheet,
    panel: cover.panel,
    locate: cover.locate,
    count,
  });
}

/** Fit the national composition below the permanent search bar. */
export function nationalPadding({ width, cover }: Frame) {
  return nationalCameraPadding(Math.max(cover.bar ?? 64, cover.notices), width);
}

/**
 * The camera that shows a level: the national composition below the search
 * bar, or a region or prefecture clear of every panel.
 */
export function levelCamera(
  frame: Frame,
  focus: Pick<MapFocus, "area" | "pref">,
  pins: Parameters<typeof focusCamera>[1],
) {
  return {
    ...focusCamera(focus, pins),
    padding:
      focus.area === null ? nationalPadding(frame) : selectionPadding(frame),
  };
}
