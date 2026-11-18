import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRef } from "react";
import { MapDetailSheet } from "./map-detail-sheet";
import type { SheetState } from "../../features/map/detail-sheet";
import type { Data } from "../../domain/types";
import { testCard } from "../../domain/test-data";

const renders = vi.hoisted(
  () => [] as { onExpand?: () => void; onShowLid: () => void }[],
);
vi.mock("../../features/card-detail/card-detail", () => ({
  CardDetail: (props: (typeof renders)[number]) => {
    renders.push(props);
    return null;
  },
}));
afterEach(() => {
  cleanup();
  renders.length = 0;
});
type Props = Parameters<typeof MapDetailSheet>[0];
const detail: Props["detail"] = {
  selection: { ids: ["card"], started: 1, pinId: "pin" },
  searching: false,
  selected: testCard({ id: "card", city: "砂川市" }),
  group: [],
  searchDetail: false,
  catalog: null,
  revealedLid: undefined,
  showLid: vi.fn(),
  showPlaces: vi.fn(),
  choosePlace: vi.fn(),
  choice: "",
  setChoice: vi.fn(),
};
const detailRef = createRef<HTMLElement>();
function sheet(state: SheetState) {
  return {
    close: vi.fn(),
    closeSheet: vi.fn(),
    sheetDrag: {
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
    },
    sheetCollapsed: state === "collapsed",
    detailRef,
    sheetState: state,
    opening: state !== "collapsed",
    full: state === "full",
    layoutFull: false,
    finishMotion: vi.fn(),
    moveMap: vi.fn(),
    mobile: true,
    expandSheet: vi.fn(),
    summarizeSheet: vi.fn(),
    chooseFromGroup: vi.fn(),
  } satisfies Props["sheet"];
}
it("keeps the card's content out of a render that only moves the sheet", () => {
  const data: Data = {
    schema: 1,
    updated: "",
    cards: [],
    places: [],
    relations: [],
    pins: [],
  };
  const { rerender } = render(
    <MapDetailSheet data={data} detail={detail} sheet={sheet("collapsed")} />,
  );
  const mounted = renders.length;
  const next = sheet("summary");
  rerender(<MapDetailSheet data={data} detail={detail} sheet={next} />);
  expect(renders).toHaveLength(mounted);
  // Its handlers still reach the sheet's latest ones.
  renders.at(-1)!.onExpand!();
  expect(next.expandSheet).toHaveBeenCalledTimes(1);
  renders.at(-1)!.onShowLid();
  expect(next.moveMap).toHaveBeenCalledWith(detail.showLid);
});
