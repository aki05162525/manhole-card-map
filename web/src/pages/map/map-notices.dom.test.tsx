import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MapNotices } from "./map-notices";
import { MapStatus } from "../../features/map/map-status";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const props = {
  fixture: false,
  issues: [],
  closeCard: () => {},
  message: "",
  asOf: "2026-11-01",
};
it("has no empty notice surface", () => {
  const v = render(<MapNotices {...props} />);
  expect(v.container.querySelector(".map-notices")).toBeNull();
});
it("tracks offline and online with the data reference date", () => {
  render(<MapNotices {...props} />);
  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.getByRole("status").textContent).toBe(
    "オフラインです。基準日 2026-11-01 時点の情報を表示しています",
  );
  expect(screen.getByText("2026-11-01").tagName).toBe("TIME");
  act(() => window.dispatchEvent(new Event("online")));
  expect(screen.queryByText(/オフラインです/)).toBeNull();
});
it("announces data failure and reload action", () => {
  render(<MapNotices {...props} dataError="network" />);
  expect(screen.getByRole("alert").textContent).toContain(
    "カード情報を読み込めませんでした",
  );
  expect(screen.getByRole("button", { name: "再読み込み" })).toBeTruthy();
});
it("leaves the map uncovered while it loads and offers retry on failure", () => {
  vi.useFakeTimers();
  const v = render(<MapStatus state="loading" />);
  act(() => vi.advanceTimersByTime(1000));
  expect(v.container.textContent).toBe("");
  v.rerender(<MapStatus state="ready" />);
  expect(v.container.textContent).toBe("");
  v.rerender(<MapStatus state="failed" />);
  expect(
    screen.getByText("背景地図を読み込めませんでした。検索と一覧は使えます。"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
});
it("uses navigator.onLine initially and cleans up listeners", () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const remove = vi.spyOn(window, "removeEventListener");
  const v = render(<MapNotices {...props} />);
  expect(screen.getByText("2026-11-01")).toBeTruthy();
  v.unmount();
  expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
  vi.restoreAllMocks();
});
