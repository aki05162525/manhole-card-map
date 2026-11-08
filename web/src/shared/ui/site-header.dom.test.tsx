import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SiteHeader } from "./site-header";

afterEach(cleanup);
it.each(["cards", "about"] as const)(
  "marks only the current document: %s",
  (current) => {
    render(<SiteHeader current={current} />);
    const nav = screen.getByRole("navigation", {
      name: "メインナビゲーション",
    });
    const active = current === "cards" ? "一覧" : "このサイトについて";
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.getAttribute("aria-current")).toBe(
        link === within(nav).getByRole("link", { name: active })
          ? "page"
          : null,
      );
    }
    expect(
      screen
        .getByRole("link", { name: "マンホール手帳 地図へ" })
        .getAttribute("href"),
    ).toBe("/");
  },
);
