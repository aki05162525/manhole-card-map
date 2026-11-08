import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Data } from "../../domain/types";
import type { MapStage } from "../../features/map/map-stage";
import App from "./map-page";

const stage = vi.hoisted(() => ({
  current: null as ComponentProps<typeof MapStage> | null,
}));
vi.mock("../../features/map/map-stage", () => ({
  MapStage: (props: ComponentProps<typeof MapStage>) => {
    stage.current = props;
    return null;
  },
}));
vi.mock("../../features/card-data/use-card-data", () => ({
  useCardData: () => ({ data, fixture: true }),
}));
vi.mock("../../shared/browser/painted", () => ({
  painted: () => new Promise(() => {}),
}));
const data: Data = {
  schema: 1,
  updated: "",
  places: ["p1", "p2"].map((id) => ({
    id,
    name: id,
    address: "",
    phone: "",
    coordinate: { status: "confirmed", lat: 35, lng: 139 },
  })),
  relations: [],
  pins: [
    {
      id: "p1",
      kind: "place",
      cardIds: ["a"],
      pref: "東京都",
      lat: 35,
      lng: 139,
      reference: false,
      status: "active",
    },
    {
      id: "p2",
      kind: "place",
      cardIds: ["a", "b"],
      pref: "東京都",
      lat: 36,
      lng: 140,
      reference: false,
      status: "active",
    },
  ],
  cards: [
    {
      id: "b",
      pref: "東京都",
      city: "港区",
      series: "",
      issued: "",
      acquired: "",
      status: "active",
      lid: { status: "unconfirmed" },
      placeText: null,
      hours: null,
      links: null,
    },
    {
      id: "a",
      pref: "東京都",
      city: "千代田区",
      series: "",
      issued: "",
      acquired: "",
      status: "active",
      lid: { status: "unconfirmed" },
      placeText: null,
      hours: null,
      links: null,
    },
  ],
};
beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("keeps search and nullable card details usable after a map failure", () => {
  render(<App />);
  act(() => stage.current!.onError("map failed"));
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "千代田" },
  });
  fireEvent.click(screen.getByRole("button", { name: /千代田区.*東京都/ }));
  expect(screen.getByRole("region", { name: "カードの詳細" })).toBeTruthy();
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: /東京都 千代田区/ }),
  );
  expect(screen.getByText("背景地図を読み込めませんでした。")).toBeTruthy();
});
it("stops delegated Escape at the detail and restores the map opener's focus", () => {
  render(<App />);
  const opener = screen.getByRole("button", { name: "カードを検索" });
  opener.focus();
  act(() => stage.current!.onSelect(["a"], "p1"));
  const escape = vi.fn();
  document.addEventListener("keydown", escape, { once: true });
  fireEvent.keyDown(screen.getByRole("heading", { name: /東京都 千代田区/ }), {
    key: "Escape",
  });
  expect(escape).not.toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: "カードの詳細" })).toBeNull();
  expect(document.activeElement).toBe(opener);
});
it("collapses mobile detail without changing URL and focuses close before hiding the body", () => {
  render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const url = location.href;
  screen.getByRole("heading", { name: /東京都 千代田区/ }).focus();
  // Put focus inside the detail body, as when reading facility information.
  const section = screen.getByRole("region", { name: "カードの詳細" });
  const body = section.querySelector(".detail-body")!;
  const link = document.createElement("button");
  body.append(link);
  link.focus();
  act(() => stage.current!.onDismiss!());
  expect(section.classList.contains("is-collapsed")).toBe(true);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "閉じる" }),
  );
  expect(location.href).toBe(url);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  expect(section.classList.contains("is-collapsed")).toBe(false);
});
it("keeps the empty map selection stable while typing in search", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  const empty = stage.current!.selectedPins;
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "千代田" },
  });
  expect(stage.current!.selectedPins).toBe(empty);
});

it("restores the search row on browser back and detail on forward", async () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "千代田" },
  });
  fireEvent.click(screen.getByRole("button", { name: /千代田区.*東京都/ }));
  expect(location.search).toBe("?card=a");
  act(() => history.back());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      container.querySelector('[data-card="a"]'),
    ),
  );
  expect(screen.queryByRole("region", { name: "カードの詳細" })).toBeNull();
  expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
  act(() => history.forward());
  await waitFor(() => {
    expect(screen.getByRole("region", { name: "カードの詳細" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: /東京都 千代田区/ }),
    );
  });
});
it("restores mapFocus with popstate while leaving the URL unchanged", () => {
  render(<App />);
  act(() => stage.current!.onFocus({ area: "kanto", pref: "東京都" }));
  expect(stage.current!.focus).toEqual({ area: "kanto", pref: "東京都" });
  expect(history.state.mapFocus).toEqual(stage.current!.focus);
  expect(location.search).toBe("");
  act(() => {
    history.replaceState({ mapFocus: { area: "kanto", pref: null } }, "", "/");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
  expect(stage.current!.focus).toEqual({ area: "kanto", pref: null });
});

it("animates floating detail close for 200ms and clears a direct URL afterward", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  history.replaceState(null, "", "/?card=a");
  render(<App />);
  const panel = screen.getByRole("region", { name: "カードの詳細" });
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
  expect(panel.style.transform).toBe("translateY(100%)");
  act(() => vi.advanceTimersByTime(199));
  expect(screen.getByRole("region", { name: "カードの詳細" })).toBe(panel);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("region", { name: "カードの詳細" })).toBeNull();
  expect(location.search).toBe("");
});
it("cancels pending sheet close when a card is selected again", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  history.replaceState(null, "", "/?card=a");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
  act(() => stage.current!.onSelect(["a"], "p1"));
  act(() => vi.advanceTimersByTime(200));
  expect(
    screen.getByRole("region", { name: "カードの詳細" }).style.transform,
  ).toBe("");
  expect(location.search).toBe("?card=a");
});

it("map tap anchors a multi-facility card to one pin, search resets it to all facilities", () => {
  render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  expect(stage.current!.selectedPins).toEqual([data.pins[0]]);
  expect(location.search).toBe("?card=a");
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "千代田" },
  });
  fireEvent.click(screen.getByRole("button", { name: /千代田区.*東京都/ }));
  expect(stage.current!.selectedPins).toEqual(data.pins);
});

it("shared location opens a group and keeps that pin through detail and return to group", () => {
  render(<App />);
  act(() => stage.current!.onSelect(["a", "b"], "p2"));
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([data.pins[1]]);
  fireEvent.click(
    screen.getByRole("button", { name: "選んだカードの詳細を開く" }),
  );
  expect(screen.getByRole("heading", { name: /東京都 千代田区/ })).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([data.pins[1]]);
  fireEvent.click(screen.getByRole("button", { name: "一覧に戻る（2枚）" }));
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([data.pins[1]]);
  fireEvent.change(screen.getByRole("listbox"), { target: { value: "b" } });
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
  expect(screen.getByRole("heading", { name: /東京都 港区/ })).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([data.pins[1]]);
});

it("shared card URL highlights all confirmed facilities", () => {
  history.replaceState(null, "", "/?card=a");
  render(<App />);
  expect(stage.current!.selectedPins).toEqual(data.pins);
});

it("focuses the detail heading after the search exit animation completes", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "千代田" },
  });
  const dialog = screen.getByRole("dialog") as HTMLDialogElement;
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  Object.defineProperty(dialog, "getAnimations", {
    value: () => [{ finished }],
  });
  fireEvent.click(screen.getByRole("button", { name: /千代田区.*東京都/ }));
  expect(dialog.open).toBe(true);
  await act(async () => {
    finish();
    await finished;
  });
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: /東京都 千代田区/ }),
  );
});
