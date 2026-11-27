import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MapNotices } from "./map-notices";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
  expect(
    v.container.querySelector(".map-notices")?.hasAttribute("hidden"),
  ).toBe(true);
});
it("tracks offline and online with the data reference date", () => {
  render(<MapNotices {...props} />);
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
  expect(screen.getByRole("status").textContent).toBe(
    "オフラインです。基準日 2026-11-01 時点の情報を表示しています",
  );
  expect(screen.getByText("2026-11-01").tagName).toBe("TIME");
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  expect(screen.queryByText(/オフラインです/)).toBeNull();
});
it("announces data failure and reload action", () => {
  render(<MapNotices {...props} dataError="network" />);
  expect(screen.getByRole("alert").textContent).toContain(
    "地図のピンを読み込めませんでした。検索と一覧は使えます。",
  );
  expect(screen.getByRole("button", { name: "再読み込み" })).toBeTruthy();
});
it("tells a basemap that failed, with the way to the list and a retry", () => {
  const reload = vi.fn();
  vi.stubGlobal("location", { reload });
  const v = render(<MapNotices {...props} />);
  expect(v.container.textContent).toBe("");
  v.rerender(<MapNotices {...props} mapFailed />);
  expect(screen.getByRole("alert").textContent).toContain(
    "背景地図を読み込めませんでした。検索と一覧は使えます。",
  );
  expect(
    screen.getByRole("link", { name: "一覧を開く" }).getAttribute("href"),
  ).toBe("/cards");
  fireEvent.click(screen.getByRole("button", { name: "再試行" }));
  expect(reload).toHaveBeenCalledOnce();
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
