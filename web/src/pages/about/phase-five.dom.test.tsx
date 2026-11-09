import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AboutPage } from "./about-page";
import { credits } from "./about-credits";
import { summarizeAbout } from "./about-summary";
import { fixtureData } from "../../../scripts/fixtures";
import { NotFoundPage } from "../not-found/not-found-page";

afterEach(cleanup);
it("配信データを差し替えると枚数・配布施設ピン数・基準日が変わる", () => {
  const data = { ...fixtureData, evaluatedAt: "2026-11-06" };
  const { rerender } = render(<AboutPage summary={summarizeAbout(data)} />);
  expect(screen.getByText(`${data.cards.length}枚`)).toBeTruthy();
  expect(
    screen.getByText(
      `${data.pins.filter((p) => p.kind === "place").length}か所`,
    ),
  ).toBeTruthy();
  expect(screen.getByText("2026-11-06時点")).toBeTruthy();
  const replacement = {
    ...data,
    cards: data.cards.slice(0, 1),
    pins: [],
    evaluatedAt: "2026-11-07",
  };
  rerender(<AboutPage summary={summarizeAbout(replacement)} />);
  expect(screen.getByText("1枚")).toBeTruthy();
  expect(screen.getByText("0か所")).toBeTruthy();
  expect(screen.getByText("2026-11-07時点")).toBeTruthy();
});
it("h1は横組みの1つ、冒頭はロゴでなく蓋、2段に地図と一覧への入口を持つ", () => {
  const { container } = render(<AboutPage />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "マンホール手帳",
  );
  expect(container.querySelector("main .logo")).toBeNull();
  expect(container.querySelector(".site-header .wordmark")).toBeNull();
  expect(container.querySelectorAll(".about-sr-only")).toHaveLength(1);
  expect(
    container.querySelector(".about-catch")?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(
    container.querySelector(".about-lid")?.getAttribute("aria-hidden"),
  ).toBe("true");
  for (const name of ["① 受け取る", "② 訪ねる"]) {
    const section = screen.getByRole("region", { name });
    expect(
      within(section).getByRole("link", { name: /地図/ }).getAttribute("href"),
    ).toBe("/");
    expect(
      within(section).getByRole("link", { name: /一覧/ }).getAttribute("href"),
    ).toBe("/cards.html");
  }
  for (const credit of credits) {
    expect(
      container.querySelector(`.about-colophon a[href="${credit.url}"]`),
    ).toBeTruthy();
    expect(container.querySelector(".about-colophon")?.textContent).toContain(
      credit.name,
    );
  }
  expect(container.querySelector(".about-colophon dl")).toBeTruthy();
});
it("404は共通の帯と欠けた刻みのロゴ、2つの復帰先を示す", () => {
  const { container } = render(<NotFoundPage />);
  expect(
    screen.getByRole("heading", { name: "ページが見つかりません", level: 1 }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "地図へ" }).getAttribute("href"),
  ).toBe("/");
  expect(
    screen.getByRole("link", { name: "一覧へ" }).getAttribute("href"),
  ).toBe("/cards.html");
  expect(container.querySelector(".site-header")).toBeTruthy();
  expect(container.querySelector("main .logo[data-incomplete]")).toBeTruthy();
});
