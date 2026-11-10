import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { SiteHeader } from "./site-header";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

// jsdom applies no container queries, so the inline links and the (closed)
// menu are both in the tree; `.site-nav-links` is the wide layout.
const inline = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(".site-nav-links")!);

it.each(["cards", "about", "friends"] as const)(
  "marks only the current document: %s",
  (current) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
    const { container } = render(<SiteHeader current={current} />);
    const nav = inline(container);
    const active = {
      cards: "一覧",
      about: "このサイトについて",
      friends: "フレンド",
    }[current];
    for (const link of nav.getAllByRole("link")) {
      expect(link.getAttribute("aria-current")).toBe(
        link === nav.getByRole("link", { name: active }) ? "page" : null,
      );
    }
    expect(
      screen
        .getByRole("link", { name: "マンホール手帳 地図へ" })
        .getAttribute("href"),
    ).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    const menu = within(container.querySelector<HTMLElement>(".site-menu")!);
    for (const link of menu.getAllByRole("link"))
      expect(link.getAttribute("aria-current")).toBe(
        link.textContent === active ? "page" : null,
      );
  },
);

it("puts friends before the account among the wide links", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const { container } = render(<SiteHeader />);
  expect(
    inline(container)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/", "/cards.html", "/friends", "/account.html", "/about.html"]);
});

it("omits friends from the wide links unless the build enables accounts", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  const { container } = render(<SiteHeader />);
  expect(
    inline(container)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/", "/cards.html", "/about.html"]);
});

it("shows either the links or the menu, never both, by the band's width", () => {
  const css = readFileSync("src/shared/ui/site-header.css", "utf8");
  expect(css).toMatch(
    /@container site-header \(width < 40em\)\s*\{\s*\.site-header \.site-nav-links\s*\{\s*display: none;/,
  );
  expect(css).toMatch(
    /@container site-header \(width >= 40em\)\s*\{\s*\.site-header \.site-menu\s*\{\s*display: none;/,
  );
});
