// Where the map's layout changes with the shape of the screen, and the motion
// setting. The CSS of pages/map repeats these numbers in its media queries;
// screen-shape.test.ts holds every one of them to the functions here.

/** At most this wide, a phone's or a tablet's: no side controls. */
export const NARROW_WIDTH = 1000;
/** At most this high and at least UPRIGHT_WIDTH wide, a landscape phone. */
export const SHORT_HEIGHT = 540;
/**
 * Narrower than this, a phone held upright: the detail floats however short
 * the screen, and the map (on its own width) packs its national view tighter.
 */
export const UPRIGHT_WIDTH = 600;

/** style.css and map-search.css lay out a desktop from this width on. */
export const WIDE_QUERY = `(min-width: ${NARROW_WIDTH + 1}px)`;

export function narrowScreen(width: number) {
  return width <= NARROW_WIDTH;
}
/** The detail floats over the map as a sheet instead of a panel beside it. */
export function floatingDetail(width: number, height: number) {
  return (
    narrowScreen(width) && !(height <= SHORT_HEIGHT && width >= UPRIGHT_WIDTH)
  );
}
/** A map this wide shows smaller national badges and margins. */
export function compactMap(width: number) {
  return width < UPRIGHT_WIDTH;
}

/** Read on each use: the setting may change while the page is open. */
export function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
