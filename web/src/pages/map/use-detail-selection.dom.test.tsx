import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Data, Pin } from "../../domain/types";
import type { Adapter } from "../../features/map/types";
import { useDetailSelection } from "./use-detail-selection";

afterEach(cleanup);
it("gives the map the selected card's places or its lid, and returns the camera on close", () => {
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
  const { result } = renderHook(() =>
    useDetailSelection(data, data, adapterRef),
  );
  // Tapped on the map: the pin stays the destination of an ended card too.
  act(() => result.current.show(["a"], undefined, undefined, place.id));
  expect(result.current.selectedPins).toEqual([place]);
  act(() => result.current.showLid());
  expect(result.current.selectedPins).toEqual([lid]);
  expect(result.current.pins).toContain(lid);
  expect(result.current.pins).not.toContainEqual(
    expect.objectContaining({ id: "other" }),
  );
  act(() => result.current.showPlaces());
  expect(result.current.selectedPins).toEqual([place]);
  expect(location.search).toBe("");
  // The lid's own pin, tapped again while it is shown.
  act(() => {
    result.current.selectCard("a");
    result.current.show(["a"], undefined, undefined, lid.id);
  });
  expect(result.current.selectedPins).toEqual([lid]);
  expect(result.current.revealedLid).toBe("a");
  // Closing takes the lid off the map: the camera goes back to the places.
  expect(select).not.toHaveBeenCalled();
  act(() => result.current.clearSelection());
  expect(select).toHaveBeenLastCalledWith([place]);
  expect(result.current.selectedPins).toEqual([]);
});
