import { areas, prefectures } from "../../prefectures";
import type { MapFocus } from "./map-levels";

const NATIONWIDE: MapFocus = { area: null, pref: null };
const isFields = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The level a history entry shows. The initial entry has no state, and an
 * entry may predate this code: anything but a known area, alone or with one
 * of its prefectures, returns to nationwide. `preserveCamera` is kept only
 * when true, as a zoom out by hand writes it.
 */
export function readMapFocus(state: unknown): MapFocus {
  const focus = isFields(state) ? state.mapFocus : undefined;
  if (!isFields(focus)) return NATIONWIDE;
  const area = areas.find((a) => a.id === focus.area)?.id ?? null;
  const pref =
    focus.pref === null
      ? null
      : prefectures.find((p) => p.name === focus.pref && p.area === area);
  if (!area || pref === undefined) return NATIONWIDE;
  return {
    area,
    pref: pref?.name ?? null,
    ...(focus.preserveCamera === true && { preserveCamera: true }),
  };
}
export function withMapFocus(state: unknown, focus: MapFocus) {
  return { ...(isFields(state) ? state : {}), mapFocus: focus };
}
