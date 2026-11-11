import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Data, Pin } from "../../domain/types";
import type { Adapter } from "../../features/map/types";
import { useDetailSelection } from "./use-detail-selection";

afterEach(cleanup);
it("switches only the selected card's confirmed facility/lid pins through the existing Adapter API", () => {
  history.replaceState(null, "", "/");
  const place: Pin = {
    id: "facility",
    kind: "place",
    cardIds: ["a"],
    pref: "東京都",
    lat: 35,
    lng: 139,
    status: "ended",
  };
  const lid: Pin = { ...place, id: "lid:a", kind: "lid" };
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [
      {
        id: "a",
        pref: "東京都",
        city: "千代田区",
        series: "",
        issued: "",
        acquired: "",
        status: "ended",
        lid: { status: "confirmed", lat: 35, lng: 139 },
        placeText: null,
        hours: null,
        links: null,
      },
    ],
    places: [
      {
        id: "facility",
        name: "施設",
        address: "",
        phone: "",
        coordinate: { status: "confirmed", lat: 35, lng: 139 },
      },
    ],
    relations: [],
    pins: [place, lid, { ...lid, id: "other", cardIds: ["b"] }],
  };
  const select = vi.fn();
  const adapterRef = { current: { select } as unknown as Adapter };
  const { result } = renderHook(() => useDetailSelection(data, adapterRef));
  act(() => result.current.show(["a"]));
  expect(result.current.selectedPins).toEqual([place]);
  act(() => result.current.showLid());
  expect(select).toHaveBeenLastCalledWith([lid]);
  expect(result.current.selectedPins).toEqual([lid]);
  act(() => result.current.showPlaces());
  expect(select).toHaveBeenLastCalledWith([place]);
  expect(result.current.selectedPins).toEqual([place]);
  expect(location.search).toBe("");
  const secondLid: Pin = { ...lid, id: "lid:second" };
  data.pins.push(secondLid);
  act(() => {
    result.current.selectCard("a");
    result.current.show(["a"], undefined, undefined, secondLid.id);
  });
  expect(result.current.selectedPins).toEqual([secondLid]);
  expect(result.current.revealedLid).toBe("a");
  expect(result.current.pins).toContain(secondLid);
  act(() => result.current.showPlaces());
  expect(result.current.selectedPins).toEqual([place]);
});
