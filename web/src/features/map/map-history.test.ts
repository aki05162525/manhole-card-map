import { expect, it } from "vitest";
import { readMapFocus, withMapFocus } from "./map-history";
const nationwide = { area: null, pref: null };
it.each([
  ["a new history entry", null],
  ["an entry without a focus", {}],
  ["a string", "kanto"],
  ["a focus that is not an object", { mapFocus: "kanto" }],
  ["an array", { mapFocus: ["kanto", "東京都"] }],
  ["an unknown area", { mapFocus: { area: "atlantis", pref: null } }],
  ["an unknown prefecture", { mapFocus: { area: "kanto", pref: "13" } }],
  [
    "a prefecture of another area",
    { mapFocus: { area: "kinki", pref: "東京都" } },
  ],
  [
    "a prefecture without its area",
    { mapFocus: { area: null, pref: "東京都" } },
  ],
  ["fields of another type", { mapFocus: { area: 3, pref: false } }],
  [
    "an unknown level that asks to keep the camera",
    { mapFocus: { area: null, pref: "東京都", preserveCamera: true } },
  ],
])("returns to nationwide from %s", (_, state) => {
  expect(readMapFocus(state)).toEqual(nationwide);
});
it("ignores a non-boolean camera flag on a valid area", () => {
  const area = { area: "kanto", pref: null };
  expect(
    readMapFocus({ mapFocus: { ...area, preserveCamera: "yes" } }),
  ).toEqual(area);
});
it("writes the focus beside the other owners' history", () => {
  expect(
    withMapFocus(
      { extra: 1, mapFocus: nationwide },
      { area: "kanto", pref: null },
    ),
  ).toEqual({ extra: 1, mapFocus: { area: "kanto", pref: null } });
  expect(withMapFocus(null, nationwide)).toEqual({ mapFocus: nationwide });
});
it.each([
  { area: null, pref: null },
  { area: null, pref: null, preserveCamera: true },
  { area: "kanto", pref: null },
  { area: "kanto", pref: null, preserveCamera: true },
  { area: "kanto", pref: "東京都" },
  { area: "kanto", pref: "東京都", preserveCamera: true },
])("reads back the focus it wrote: %o", (focus) => {
  expect(readMapFocus(withMapFocus(null, focus))).toEqual(focus);
});
