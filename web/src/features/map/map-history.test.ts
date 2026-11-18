import { expect, it } from "vitest";
import { readMapFocus, withMapFocus } from "./map-history";
const nationwide = { area: null, pref: null };
it("restores history focus and returns to nationwide for an entry without state", () => {
  expect(readMapFocus(null)).toEqual(nationwide);
  expect(readMapFocus({})).toEqual(nationwide);
  expect(readMapFocus({ mapFocus: { area: "kanto", pref: "東京都" } })).toEqual(
    { area: "kanto", pref: "東京都" },
  );
  expect(readMapFocus({ mapFocus: { area: "kanto", pref: null } })).toEqual({
    area: "kanto",
    pref: null,
  });
});
it("keeps the camera only when the entry says so", () => {
  expect(
    readMapFocus({
      mapFocus: { area: "kanto", pref: null, preserveCamera: true },
    }),
  ).toEqual({ area: "kanto", pref: null, preserveCamera: true });
  expect(
    readMapFocus({
      mapFocus: { area: "kanto", pref: null, preserveCamera: "yes" },
    }),
  ).toEqual({ area: "kanto", pref: null });
});
it.each([
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
])("returns to nationwide from %s", (_, state) => {
  expect(readMapFocus(state)).toEqual(nationwide);
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
