/** A facility pin as the prefecture's drawing places it on the screen. */
export type PinSpot = { id: string; x: number; y: number };

/** A fingertip's reach around a press; a mouse's, the map's own box. */
export const FINGER_REACH = 22;
export const POINTER_REACH = 12;
/**
 * The closest the drawing comes on its own (MapLibre's zoom). Facilities
 * still under one fingertip there, about 40m apart in the middle of Japan,
 * share a site or a building: their names tell them apart.
 */
export const STAGE_MAX_ZOOM = 15;
/** How much closer each press over several facilities brings the drawing. */
export const CLOSER = 4;

export type Press =
  /** Nothing under it. */
  | { kind: "none" }
  /** One facility: it is chosen. */
  | { kind: "one"; id: string }
  /** Several, apart enough to be pressed one by one when drawn closer. */
  | { kind: "closer" }
  /** Several that no drawing tells apart: they are offered by name. */
  | { kind: "ledger"; ids: string[] };

/**
 * What a press at (x, y) takes, `reach` px around it, on a drawing at
 * `zoom`. The pins never move: where several are under the press, the
 * drawing comes closer around it, until they are apart or the drawing can
 * come no closer; those left together (the same coordinates, or a site
 * smaller than a fingertip at the closest drawing) are listed instead.
 */
export function pressAt(
  spots: PinSpot[],
  x: number,
  y: number,
  reach: number,
  zoom: number,
): Press {
  const under = spots
    .map((spot) => ({ spot, distance: Math.hypot(spot.x - x, spot.y - y) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance)
    .map(({ spot }) => spot);
  if (!under.length) return { kind: "none" };
  if (under.length === 1) return { kind: "one", id: under[0].id };
  // How far apart the farthest two would be at the closest drawing.
  const room = 2 ** (STAGE_MAX_ZOOM - zoom);
  const spread = Math.max(
    ...under.flatMap((a) => under.map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
  );
  return zoom < STAGE_MAX_ZOOM - 1e-9 && spread * room >= reach
    ? { kind: "closer" }
    : { kind: "ledger", ids: under.map((spot) => spot.id) };
}
