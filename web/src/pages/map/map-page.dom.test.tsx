import { painted } from "../../shared/browser/painted";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushSync } from "react-dom";
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
  painted: vi.fn(() => new Promise<void>(() => {})),
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
      status: "active",
    },
    {
      id: "p2",
      kind: "place",
      cardIds: ["a", "b"],
      pref: "東京都",
      lat: 36,
      lng: 140,
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
  vi.unstubAllEnvs();
  vi.mocked(painted).mockImplementation(() => new Promise<void>(() => {}));
  document.cookie = "signed_in=; Max-Age=0; Path=/";
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
  expect(
    screen.getByText("背景地図を読み込めませんでした。検索と一覧は使えます。"),
  ).toBeTruthy();
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

it("leaves Japanese input to the keyboard's defaults", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
  // iOS can lose Japanese conversion when these are switched off.
  for (const name of ["autocorrect", "spellcheck", "autocapitalize"])
    expect(screen.getByRole("searchbox").hasAttribute(name)).toBe(false);
  // Safari AutoFill reads 「カード番号」 as a credit card number and locks the
  // keyboard to Latin letters.
  expect(screen.getByRole("searchbox").getAttribute("autocomplete")).toBe(
    "off",
  );
  expect(screen.getByLabelText(/自治体・施設・番号/)).toBe(
    screen.getByRole("searchbox"),
  );
  expect(document.body.textContent).not.toContain("カード番号");
});
it("keeps search usable before readiness and tracks location acquisition", () => {
  let success!: PositionCallback;
  const getCurrentPosition = vi.fn((callback: PositionCallback) => {
    success = callback;
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  render(<App />);
  const search = screen.getByRole("button", {
    name: "カードを検索",
  }) as HTMLButtonElement;
  const locate = screen.getByRole("button", {
    name: "現在地",
  }) as HTMLButtonElement;
  expect(search.disabled).toBe(false);
  expect(locate.disabled).toBe(true);
  const adapter = { locate: vi.fn() } as never;
  performance.mark("map-create");
  act(() => stage.current!.onReady(adapter));
  fireEvent.click(locate);
  expect(locate.getAttribute("aria-busy")).toBe("true");
  expect(locate.disabled).toBe(true);
  act(() =>
    success({
      coords: { latitude: 35, longitude: 139 },
    } as GeolocationPosition),
  );
  expect(locate.getAttribute("aria-busy")).toBe("false");
  expect(locate.disabled).toBe(false);
});

function failLocation(code: number) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (_: PositionCallback, error: PositionErrorCallback) =>
        error({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    },
  });
  render(<App />);
  act(() => stage.current!.onReady({ locate: vi.fn() } as never));
  fireEvent.click(screen.getByRole("button", { name: "現在地" }));
}
it("explains how to allow location after a denial until it is closed", () => {
  const userAgent = vi
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
  failLocation(1);
  const notice = screen.getByText(
    /位置情報の利用が許可されていません/,
  ).parentElement!;
  expect(within(notice).getByText("許可する方法")).toBeTruthy();
  expect(notice.textContent).toContain("Safari Webサイト");
  expect(notice.textContent).not.toContain("Android");
  fireEvent.click(within(notice).getByRole("button", { name: "閉じる" }));
  expect(screen.queryByText(/位置情報の利用が許可されていません/)).toBeNull();
  userAgent.mockRestore();
});
it("hides a temporary location failure by itself", () => {
  vi.useFakeTimers();
  failLocation(3);
  expect(
    screen.getByText("現在地を取得できませんでした。もう一度お試しください。"),
  ).toBeTruthy();
  expect(screen.queryByText("許可する方法")).toBeNull();
  act(() => vi.advanceTimersByTime(6000));
  expect(
    screen.queryByText(
      "現在地を取得できませんでした。もう一度お試しください。",
    ),
  ).toBeNull();
});
it("opens a full modal, ignores map dismissal, and returns to summary with the card and focus intact", async () => {
  const { container } = render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const panel = container.querySelector("#detail")!;
  expect(panel.classList.contains("is-summary")).toBe(true);
  const url = location.href;
  const length = history.length;
  fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
  expect(panel.getAttribute("role")).toBe("dialog");
  expect(panel.getAttribute("aria-modal")).toBe("true");
  expect(container.querySelector("#map")!.hasAttribute("inert")).toBe(true);
  expect(history.length).toBe(length + 1);
  expect(history.state.sheet).toBe("full");
  expect(location.href).toBe(url);
  expect(document.activeElement).toBe(panel.querySelector("h2"));
  act(() => stage.current!.onDismiss!());
  expect(panel.classList.contains("is-full")).toBe(true);
  act(() => history.back());
  await waitFor(() =>
    expect(panel.classList.contains("is-summary")).toBe(true),
  );
  expect(container.querySelector("#detail")).toBe(panel);
  expect(location.href).toBe(url);
  expect(container.querySelector("#map")!.hasAttribute("inert")).toBe(false);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "詳しく" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "詳細を全画面で開く" }));
  fireEvent.click(screen.getByRole("button", { name: "詳細を要約に戻す" }));
  await waitFor(() =>
    expect(panel.classList.contains("is-summary")).toBe(true),
  );
  fireEvent.click(panel.querySelector(".detail-body")!);
  expect(panel.classList.contains("is-full")).toBe(true);
});
it("does not interpret sheet-only history as a change to a shared-location selection", async () => {
  render(<App />);
  act(() => stage.current!.onSelect(["a", "b"], "p2"));
  fireEvent.click(screen.getByRole("button", { name: "詳細を全画面で開く" }));
  act(() => history.back());
  await waitFor(() =>
    expect(document.querySelector("#detail.is-summary")).not.toBeNull(),
  );
  expect(
    screen.getByRole("heading", { name: "この場所のカード 2枚" }),
  ).toBeTruthy();
  expect(stage.current!.selectedPins).toEqual([data.pins[1]]);
});

it("handles back even when an earlier popstate listener synchronously rerenders the page", async () => {
  let rerenderPage = () => {};
  const earlier = () => flushSync(rerenderPage);
  window.addEventListener("popstate", earlier);
  try {
    const { rerender, container } = render(<App />);
    rerenderPage = () => rerender(<App />);
    act(() => stage.current!.onSelect(["a"], "p1"));
    fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
    fireEvent.click(screen.getByRole("button", { name: "詳細を要約に戻す" }));
    await waitFor(() =>
      expect(container.querySelector("#detail.is-summary")).not.toBeNull(),
    );
  } finally {
    window.removeEventListener("popstate", earlier);
  }
});

it("consumes full-view history before choosing a card from the shared location", async () => {
  const { container } = render(<App />);
  act(() => stage.current!.onSelect(["a", "b"], "p2"));
  fireEvent.click(screen.getByRole("button", { name: "詳細を全画面で開く" }));
  fireEvent.click(screen.getByRole("button", { name: "千代田区 a（配布中）" }));
  await waitFor(() =>
    expect(container.querySelector("#detail.is-summary")).not.toBeNull(),
  );
  expect(history.state?.sheet).not.toBe("full");
  expect(location.search).toBe("?card=a");
});

it.each([
  ["蓋の場所", true],
  ["配布場所に戻る", true],
  ["蓋の場所", false],
  ["配布場所に戻る", false],
] as const)(
  "consumes full history and reveals the summary before moving the map: %s",
  async (action, reduced) => {
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    const card = data.cards[1];
    const oldLid = card.lid;
    card.lid = { status: "confirmed", lat: 35.1, lng: 139.1 };
    const lid = { ...data.pins[0], id: "lid-a", kind: "lid" as const };
    data.pins.push(lid);
    const back = vi.spyOn(history, "back");
    try {
      const { container } = render(<App />);
      const select = vi.fn(() => {
        expect(container.querySelector("#detail.is-summary")).not.toBeNull();
        expect(container.querySelector("#detail.has-full-layout")).toBeNull();
        expect(
          container.querySelector("#detail[data-sheet-moving]"),
        ).toBeNull();
        expect(history.state?.sheet).not.toBe("full");
        expect(container.querySelector("#map[inert]")).toBeNull();
      });
      performance.mark("map-create");
      act(() => stage.current!.onReady({ select } as never));
      act(() => stage.current!.onSelect(["a"], "p1"));
      const finish = () =>
        fireEvent.transitionEnd(container.querySelector("#detail")!, {
          propertyName: "transform",
        });
      const move = async (name: string) => {
        fireEvent.click(screen.getByRole("button", { name }));
        await waitFor(() =>
          expect(container.querySelector("#detail.is-summary")).not.toBeNull(),
        );
        if (!reduced) {
          expect(select).not.toHaveBeenCalled();
          finish();
        }
        await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
      };
      if (action === "配布場所に戻る") {
        fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
        finish();
        await move("蓋の場所");
        select.mockClear();
        back.mockClear();
      }
      fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
      finish();
      expect(history.state.sheet).toBe("full");
      await move(action);
      expect(back).toHaveBeenCalledTimes(1);
      expect(select).toHaveBeenLastCalledWith(
        action === "蓋の場所" ? [lid] : data.pins.slice(0, 2),
      );
    } finally {
      back.mockRestore();
      data.pins.pop();
      card.lid = oldLid;
    }
  },
);

it("defers full layout, background inert and focus until the transform ends", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const { container } = render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const panel = container.querySelector<HTMLElement>("#detail")!;
  const more = screen.getByRole("button", { name: "詳しく" });
  more.focus();
  panel.setAttribute("data-sheet-compact", "");
  fireEvent.click(more);
  expect(panel.hasAttribute("data-sheet-compact")).toBe(true);
  expect(panel.classList.contains("is-full")).toBe(true);
  expect(panel.classList.contains("has-full-layout")).toBe(false);
  expect(container.querySelector("#map[inert]")).toBeNull();
  fireEvent.transitionEnd(panel, { propertyName: "opacity" });
  expect(container.querySelector("#map[inert]")).toBeNull();
  fireEvent.transitionEnd(panel, { propertyName: "transform" });
  expect(panel.classList.contains("has-full-layout")).toBe(true);
  expect(container.querySelector("#map[inert]")).not.toBeNull();
  expect(document.activeElement).toBe(panel.querySelector("h2"));
  fireEvent.click(screen.getByRole("button", { name: "詳細を要約に戻す" }));
  await waitFor(() =>
    expect(panel.classList.contains("is-summary")).toBe(true),
  );
  expect(panel.classList.contains("has-full-layout")).toBe(true);
  expect(container.querySelector("#map[inert]")).not.toBeNull();
  fireEvent.transitionEnd(panel, { propertyName: "transform" });
  expect(panel.classList.contains("has-full-layout")).toBe(false);
  expect(container.querySelector("#map[inert]")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "詳しく" }),
  );
});

it("unfreezes measurement if full entry is reversed before its first frame", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const panel = document.querySelector("#detail")!;
  fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
  act(() => {
    history.replaceState({ ...history.state, sheet: undefined }, "");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
  expect(panel.classList.contains("is-summary")).toBe(true);
  act(() => vi.advanceTimersByTime(360));
  expect(panel.hasAttribute("data-sheet-moving")).toBe(false);
  expect(document.querySelector("#map[inert]")).toBeNull();
});

it("keeps actions outside the moving sheet and preserves the summary DOM through expansion", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const { container } = render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const panel = container.querySelector<HTMLElement>("#detail")!;
  const more = screen.getByRole("button", { name: "詳しく" });
  expect(panel.contains(more)).toBe(false);
  const summary = panel.querySelector(".sheet-summary")!;
  const markup = summary.outerHTML;
  const extra = panel.querySelector(".sheet-extra")!;
  expect(extra).not.toBeNull();
  expect(extra.hasAttribute("inert")).toBe(true);
  fireEvent.click(more);
  fireEvent.transitionEnd(panel, { propertyName: "transform" });
  expect(panel.querySelector(".sheet-summary")).toBe(summary);
  expect(summary.outerHTML).toBe(markup);
  expect(panel.querySelector(".sheet-extra")).toBe(extra);
  expect(extra.hasAttribute("inert")).toBe(false);
  expect(screen.queryByRole("button", { name: "詳しく" })).toBeNull();
});

it("returns focus from the fixed action bar before collapsing it", () => {
  render(<App />);
  act(() => stage.current!.onSelect(["a"], "p1"));
  const more = screen.getByRole("button", { name: "詳しく" });
  more.focus();
  act(() => stage.current!.onDismiss?.());
  expect(document.querySelector(".sheet-action-bar[inert]")).not.toBeNull();
  expect(document.activeElement).toBe(document.querySelector(".detail-close"));
});

it("preserves lid mode across map movement and sheet levels, and resets on new selection and close", async () => {
  const card = data.cards[1];
  const oldLid = card.lid;
  card.lid = { status: "confirmed", lat: 35.1, lng: 139.1 };
  const relation = {
    cardId: "a",
    placeId: "p1",
    condition: "",
    periodRaw: "",
    alternativeRaw: "",
  };
  data.relations.push(relation);
  try {
    const { container } = render(<App />);
    performance.mark("map-create");
    act(() => stage.current!.onReady({ select: vi.fn() } as never));
    act(() => stage.current!.onSelect(["a"], "p1"));
    const push = vi.spyOn(history, "pushState");
    fireEvent.click(screen.getByRole("button", { name: "蓋の場所" }));
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
    const lidRoute = () =>
      expect(
        container.querySelector(".primary-destination")?.textContent,
      ).toContain("蓋の経路");
    lidRoute();
    expect(
      container.querySelector(".sheet-bar-title")?.textContent?.trim(),
    ).toBe("蓋の位置・千代田区");
    act(() => stage.current!.onDismiss!());
    expect(container.querySelector("#detail.is-collapsed")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
    lidRoute();
    fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
    lidRoute();
    expect(
      container.querySelector(".card-detail-content > .lid-summary"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "詳細を要約に戻す" }));
    await waitFor(() =>
      expect(container.querySelector("#detail.is-summary")).not.toBeNull(),
    );
    lidRoute();
    act(() => stage.current!.onSelect(["a"], "p2"));
    expect(
      container.querySelector(".primary-destination")?.textContent,
    ).toContain("配布場所の経路");
    fireEvent.click(screen.getByRole("button", { name: "蓋の場所" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    await waitFor(() => expect(container.querySelector("#detail")).toBeNull());
    act(() => stage.current!.onSelect(["a"], "p1"));
    expect(
      container.querySelector(".primary-destination")?.textContent,
    ).toContain("配布場所の経路");
    fireEvent.click(screen.getByRole("button", { name: "蓋の場所" }));
    fireEvent.click(screen.getByRole("button", { name: "カードを検索" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "港区" },
    });
    fireEvent.click(screen.getByRole("button", { name: /港区.*東京都/ }));
    expect(container.querySelector(".lid-summary")).toBeNull();
  } finally {
    card.lid = oldLid;
    data.relations.pop();
  }
});

it("puts search before the map in DOM order", () => {
  const { container } = render(<App />);
  const bar = container.querySelector(".map-search-bar")!;
  expect(
    bar.compareDocumentPosition(container.querySelector("#map")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
it("uses the main route destination for the sheet title when opened without a pin", () => {
  data.relations.push(
    ...["p2", "p1"].map((placeId) => ({
      cardId: "a",
      placeId,
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
    })),
  );
  try {
    history.replaceState(null, "", "/?card=a");
    const { container } = render(<App />);
    expect(container.querySelector(".sheet-bar-title")?.textContent).toBe("p1");
  } finally {
    data.relations.splice(0);
  }
});
it("explains an unmapped search result inside the mobile summary", () => {
  const saved = data.pins.splice(0);
  try {
    history.replaceState(
      { mapSearch: { phase: "detail", query: "港区" } },
      "",
      "/?card=b",
    );
    const { container } = render(<App />);
    expect(container.querySelector(".sheet-summary")?.textContent).toContain(
      "配布場所の登録なし",
    );
  } finally {
    data.pins.push(...saved);
  }
});

it("returns the map to distribution places on close after viewing the lid", async () => {
  const card = data.cards[1];
  const old = card.lid;
  card.lid = { status: "confirmed", lat: 35.1, lng: 139.1 };
  try {
    const { container } = render(<App />);
    const select = vi.fn();
    performance.mark("map-create");
    act(() => stage.current!.onReady({ select } as never));
    act(() => stage.current!.onSelect(["a"], "p1"));
    fireEvent.click(screen.getByRole("button", { name: "蓋の場所" }));
    select.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    await waitFor(() => expect(container.querySelector("#detail")).toBeNull());
    expect(select).toHaveBeenCalledWith(data.pins);
  } finally {
    card.lid = old;
  }
});
it("returns to distribution places when browser back closes a revealed lid detail", async () => {
  const card = data.cards[1],
    old = card.lid;
  card.lid = { status: "confirmed", lat: 35.1, lng: 139.1 };
  try {
    const { container } = render(<App />);
    const select = vi.fn();
    performance.mark("map-create");
    act(() => stage.current!.onReady({ select } as never));
    act(() => stage.current!.onSelect(["a"], "p1"));
    fireEvent.click(screen.getByRole("button", { name: "蓋の場所" }));
    select.mockClear();
    act(() => history.back());
    await waitFor(() => expect(container.querySelector("#detail")).toBeNull());
    expect(select).toHaveBeenCalledWith(data.pins);
  } finally {
    card.lid = old;
  }
});

it("starts records only after map initialization and permits edits after map failure", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  vi.mocked(painted).mockResolvedValue();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/records") return new Response("[]");
      if (init?.method === "PUT")
        return new Response('{"cardId":"a","receivedOn":null}');
      return new Response(null, { status: 404 });
    }),
  );
  stage.current = null;
  render(<App />);
  await waitFor(() => expect(stage.current).not.toBeNull());
  expect(fetch).not.toHaveBeenCalled();
  act(() => stage.current!.onError("failed map"));
  await screen.findByRole("radio", { name: "回収済み" });
  act(() => stage.current!.onSelect(["a"], "p1"));
  fireEvent.click(
    await screen.findByRole("button", { name: "回収した", hidden: true }),
  );
  await screen.findByText("保存しました");
  expect(stage.current!.pins.find((pin) => pin.id === "p2")).toMatchObject({
    receipt: "some",
    status: "active",
  });
  fireEvent.click(screen.getByRole("radio", { name: "未回収" }));
  expect(stage.current!.pins.map((pin) => pin.id)).toEqual(["p2"]);
  expect(stage.current!.pins[0].cardIds).toEqual(["b"]);
});

it("announces save failures inside the full-screen detail while the background is inert", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  vi.mocked(painted).mockResolvedValue();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/me/records")
        return new Response('[{"cardId":"a","receivedOn":null}]');
      if (init?.method === "PUT") return new Response(null, { status: 500 });
      return new Response('{"cardId":"a","receivedOn":null,"memo":"保存前"}');
    }),
  );
  stage.current = null;
  const { container } = render(<App />);
  await waitFor(() => expect(stage.current).not.toBeNull());
  act(() => stage.current!.onError("failed map"));
  await screen.findByRole("radio", { name: "回収済み" });
  act(() => stage.current!.onSelect(["a"], "p1"));
  fireEvent.click(screen.getByRole("button", { name: "詳しく" }));
  const panel = screen.getByRole("dialog", { name: "カードの詳細" });
  expect(panel.getAttribute("aria-modal")).toBe("true");
  expect(container.querySelector(".map-notices")?.hasAttribute("inert")).toBe(
    true,
  );
  fireEvent.click(
    await within(panel).findByRole("button", { name: "日付・メモを編集" }),
  );
  const memo = within(panel).getByLabelText("メモ（自分だけに表示）");
  fireEvent.change(memo, { target: { value: "変更後" } });
  fireEvent.click(within(panel).getByRole("button", { name: "保存する" }));
  const alert = await within(panel).findByRole("alert");
  expect(alert.textContent).toContain("保存できませんでした");
  expect(alert.closest("[inert]")).toBeNull();
  // The form stays open with the unsaved text instead of reverting it.
  expect(within(panel).getByDisplayValue("変更後")).toBeTruthy();
  expect(
    within(container.querySelector(".map-notices") as HTMLElement).getByRole(
      "alert",
    ).textContent,
  ).toContain("保存できませんでした");
});

it("uses friend records on map pins and detail after map failure without personal fetches", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", "/?friend=f1");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            displayName: "はな",
            count: 1,
            records: [{ cardId: "a", receivedOn: "2026-11-01" }],
          }),
        ),
    ),
  );
  stage.current = null;
  render(<App />);
  await waitFor(() => expect(stage.current).not.toBeNull());
  expect(fetch).not.toHaveBeenCalled();
  act(() => stage.current!.onError("failed map"));
  await screen.findByText("はなさんの回収マップ");
  expect(stage.current!.pins.find((pin) => pin.id === "p2")).toMatchObject({
    receipt: "some",
    status: "active",
  });
  act(() => stage.current!.onSelect(["a"], "p1"));
  await screen.findByText("2026年11月1日");
  expect(
    screen.queryByRole("button", { name: "回収した", hidden: true }),
  ).toBeNull();
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    "/api/friends/f1/records",
  ]);
});
