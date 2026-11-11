import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AboutPage } from "./about-page";
import { summarizeAbout } from "./about-summary";
import { fixtureData } from "../../../scripts/fixtures";

afterEach(cleanup);
it("配信データを差し替えると枚数・配布場所ピン数・基準日が変わる", () => {
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
it("h1は1つで、装飾は支援技術から隠し、2段に地図と一覧への入口を持つ", () => {
  const { container } = render(<AboutPage />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(container.querySelectorAll(".about-sr-only")).toHaveLength(1);
  expect(
    container.querySelector(".about-catch")?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(
    container.querySelector(".about-lid")?.getAttribute("aria-hidden"),
  ).toBe("true");
  for (const name of ["受け取る", "訪ねる"]) {
    const section = screen.getByRole("region", { name });
    expect(
      within(section).getByRole("link", { name: /地図/ }).getAttribute("href"),
    ).toBe("/");
    expect(
      within(section).getByRole("link", { name: /一覧/ }).getAttribute("href"),
    ).toBe("/cards.html");
  }
});
