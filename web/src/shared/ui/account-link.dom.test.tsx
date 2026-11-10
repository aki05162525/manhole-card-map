import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

afterEach(() => {
  cleanup();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("hides the account entry unless the build enables accounts", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  vi.stubGlobal("fetch", vi.fn());
  render(<SiteHeader />);
  expect(
    screen.queryByRole("link", { name: /ログイン|アカウント/ }),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("links to sign-in without any request while signed out", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  vi.stubGlobal("fetch", vi.fn());
  render(<SiteHeader />);
  expect(
    screen.getByRole("link", { name: "ログイン" }).getAttribute("href"),
  ).toBe("/account.html");
  // The narrow layout's menu carries the same entry once opened.
  fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
  expect(
    screen
      .getAllByRole("link", { name: "ログイン" })
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/account.html", "/account.html"]);
  expect(fetch).not.toHaveBeenCalled();
});

it("links to the account while signed in", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  render(<SiteHeader current="account" />);
  const link = screen.getByRole("link", { name: "アカウント" });
  expect(link.getAttribute("href")).toBe("/account.html");
  expect(link.getAttribute("aria-current")).toBe("page");
});
