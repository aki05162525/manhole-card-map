import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MENU_OPEN, SiteMenu, type SitePage } from "./site-menu";

afterEach(() => {
  cleanup();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  Reflect.deleteProperty(HTMLElement.prototype, "popover");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const button = () => screen.getByRole("button", { name: "メニュー" });
const entries = () =>
  within(screen.getByRole("navigation", { name: "メインナビゲーション" }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);

// jsdom has no Popover API, so these exercise the scripted fallback.
it("stays closed until the button is pressed, then lists the pages in order", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  vi.stubGlobal("fetch", vi.fn());
  render(<SiteMenu />);
  expect(button().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(button());
  expect(button().getAttribute("aria-expanded")).toBe("true");
  expect(entries()).toEqual([
    ["地図", "/"],
    ["一覧", "/cards"],
    ["フレンド", "/friends"],
    ["ログイン", "/account"],
    ["このサイトについて", "/about"],
  ]);
  for (const link of screen.getAllByRole("link"))
    expect(link.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("labels the account entry from the display cookie", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  render(<SiteMenu />);
  fireEvent.click(button());
  expect(
    screen.getByRole("link", { name: "アカウント" }).getAttribute("href"),
  ).toBe("/account");
  expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();
});

it("leaves out friends and account unless the build enables accounts", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  render(<SiteMenu />);
  fireEvent.click(button());
  expect(entries()).toEqual([
    ["地図", "/"],
    ["一覧", "/cards"],
    ["このサイトについて", "/about"],
  ]);
});

it("takes the list address from the page", () => {
  render(<SiteMenu listHref="/cards?pref=13" />);
  fireEvent.click(button());
  expect(screen.getByRole("link", { name: "一覧" }).getAttribute("href")).toBe(
    "/cards?pref=13",
  );
});

it.each<[SitePage, string]>([
  ["map", "地図"],
  ["cards", "一覧"],
  ["friends", "フレンド"],
  ["account", "ログイン"],
  ["about", "このサイトについて"],
])("marks only the current page: %s", (current, label) => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  render(<SiteMenu current={current} />);
  fireEvent.click(button());
  for (const link of screen.getAllByRole("link"))
    expect(link.getAttribute("aria-current")).toBe(
      link.textContent === label ? "page" : null,
    );
});

it("closes on Escape and returns focus to the button", () => {
  render(<SiteMenu />);
  fireEvent.click(button());
  screen.getByRole("link", { name: "一覧" }).focus();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("link")).toBeNull();
  expect(button().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(button());
});

it("closes on a press outside and returns focus to the button, not on a press inside", () => {
  render(
    <>
      <SiteMenu />
      <p>外側</p>
    </>,
  );
  fireEvent.click(button());
  fireEvent.pointerDown(screen.getByRole("link", { name: "一覧" }));
  expect(button().getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(screen.getByText("外側"));
  expect(screen.queryByRole("link")).toBeNull();
  expect(document.activeElement).toBe(button());
});

it("closes when the button is pressed again, having announced only its opening", () => {
  const opened = vi.fn();
  document.addEventListener(MENU_OPEN, opened);
  render(<SiteMenu />);
  fireEvent.click(button());
  expect(opened).toHaveBeenCalledTimes(1);
  fireEvent.click(button());
  expect(screen.queryByRole("link")).toBeNull();
  expect(opened).toHaveBeenCalledTimes(1);
  document.removeEventListener(MENU_OPEN, opened);
});

it("leaves focus where it is on Escape or a press outside while closed", () => {
  render(
    <>
      <SiteMenu />
      <button type="button">外側</button>
    </>,
  );
  const outside = screen.getByRole("button", { name: "外側" });
  const dismiss = () => {
    outside.focus();
    fireEvent.keyDown(outside, { key: "Escape" });
    fireEvent.pointerDown(outside);
    return document.activeElement;
  };
  expect(dismiss()).toBe(outside);
  // Closed again: what the open menu listened to is no longer heard.
  fireEvent.click(button());
  fireEvent.click(button());
  expect(dismiss()).toBe(outside);
});

it("hands opening and dismissal to the browser where popovers exist", () => {
  Object.defineProperty(HTMLElement.prototype, "popover", {
    configurable: true,
    value: null,
  });
  const { container } = render(<SiteMenu />);
  const panel = container.querySelector(".site-menu-panel")!;
  expect(panel.getAttribute("popover")).toBe("auto");
  expect(panel.hasAttribute("hidden")).toBe(false);
  expect(panel.id).toBeTruthy();
  const trigger = container.querySelector("button")!;
  expect(trigger.getAttribute("popovertarget")).toBe(panel.id);
  // The browser reports the expanded state of a popover invoker itself.
  expect(trigger.hasAttribute("aria-expanded")).toBe(false);
});

// What the browser tells a popover of, as it opens and closes it.
function nativeMenu() {
  Object.defineProperty(HTMLElement.prototype, "popover", {
    configurable: true,
    value: null,
  });
  const { container } = render(
    <>
      <SiteMenu />
      <button type="button">外側</button>
    </>,
  );
  const panel = container.querySelector<HTMLElement>(".site-menu-panel")!;
  const tell = (type: string) => (newState: "open" | "closed") =>
    fireEvent(panel, Object.assign(new Event(type), { newState }));
  return {
    panel,
    outside: screen.getByRole("button", { name: "外側" }),
    toggling: tell("beforetoggle"),
    toggled: tell("toggle"),
  };
}

it.each([
  ["with room beside it", 300, 20],
  ["at the edge", 320, null],
  ["past the edge", 340, null],
])(
  "hangs a native popover under the button %s, within the viewport",
  (_, right, offset) => {
    const { panel, toggling } = nativeMenu();
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
      320,
    );
    // A 40px button whose bottom edge is at 40 and right edge at `right`.
    vi.spyOn(button(), "getBoundingClientRect").mockReturnValue(
      new DOMRect(right - 40, 0, 40, 40),
    );
    const place = (side: string) =>
      parseFloat(panel.style.getPropertyValue(`--site-menu-${side}`));
    toggling("closed");
    expect(panel.style.length).toBe(0);
    toggling("open");
    expect(place("top")).toBeGreaterThan(40);
    // The button's own distance from the edge, unless that leaves no margin.
    if (offset === null) expect(place("right")).toBeGreaterThan(0);
    else expect(place("right")).toBe(offset);
  },
);

it("announces the opening of a native popover, not its closing", () => {
  const opened = vi.fn();
  document.addEventListener(MENU_OPEN, opened);
  const { toggled } = nativeMenu();
  toggled("open");
  expect(opened).toHaveBeenCalledTimes(1);
  toggled("closed");
  expect(opened).toHaveBeenCalledTimes(1);
  document.removeEventListener(MENU_OPEN, opened);
});

it("returns focus to the button when a native popover closes, unless another control took it", () => {
  const { outside, toggled } = nativeMenu();
  toggled("open");
  expect(document.activeElement).toBe(document.body);
  outside.focus();
  toggled("open");
  expect(document.activeElement).toBe(outside);
  toggled("closed");
  expect(document.activeElement).toBe(outside);
  // A press outside that lands on no control leaves focus on the body.
  outside.blur();
  toggled("closed");
  expect(document.activeElement).toBe(button());
});
