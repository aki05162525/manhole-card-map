import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiteMenu } from "./site-menu";

afterEach(() => {
  cleanup();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  Reflect.deleteProperty(HTMLElement.prototype, "popover");
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
    ["一覧", "/cards.html"],
    ["フレンド", "/friends"],
    ["ログイン", "/account.html"],
    ["このサイトについて", "/about.html"],
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
  ).toBe("/account.html");
  expect(screen.queryByRole("link", { name: "ログイン" })).toBeNull();
});

it("leaves out friends and account unless the build enables accounts", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  render(<SiteMenu />);
  fireEvent.click(button());
  expect(entries()).toEqual([
    ["地図", "/"],
    ["一覧", "/cards.html"],
    ["このサイトについて", "/about.html"],
  ]);
});

it("takes the list address from the page and marks only the current page", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  render(<SiteMenu current="friends" listHref="/cards.html?pref=13" />);
  fireEvent.click(button());
  expect(screen.getByRole("link", { name: "一覧" }).getAttribute("href")).toBe(
    "/cards.html?pref=13",
  );
  for (const link of screen.getAllByRole("link"))
    expect(link.getAttribute("aria-current")).toBe(
      link.textContent === "フレンド" ? "page" : null,
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

it("closes when the button is pressed again", () => {
  render(<SiteMenu />);
  fireEvent.click(button());
  fireEvent.click(button());
  expect(screen.queryByRole("link")).toBeNull();
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
