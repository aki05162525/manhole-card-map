import { expect, it } from "vitest";
import {
  mapSearchScreen,
  searchSession,
  withMapSearch,
} from "./map-search-state";
it("keeps search exclusive from detail and preserves unrelated history", () => {
  const session = searchSession({
    query: "三島",
    limit: 100,
    scroll: 230,
    selected: "id",
  });
  expect(mapSearchScreen({ ...session, phase: "search" }, "id")).toBe("S");
  expect(mapSearchScreen({ ...session, phase: "detail" }, "id")).toBe("D");
  expect(mapSearchScreen(session, null)).toBe("M");
  expect(
    withMapSearch({ extra: 1, mapFocus: { pref: "静岡県" } }, session),
  ).toMatchObject({
    extra: 1,
    mapFocus: { pref: "静岡県" },
    mapSearch: session,
  });
});
