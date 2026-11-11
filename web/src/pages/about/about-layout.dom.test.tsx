import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AboutPage } from "./about-page";
import { summarizeAbout } from "./about-summary";
import { fixtureData } from "../../../scripts/fixtures";

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
});
it("件数の区切りは支援技術から隠し、読み上げ文は件数と基準日をつなぐ", () => {
  const { container } = render(
    <AboutPage summary={summarizeAbout(fixtureData)} />,
  );
  expect(
    container.querySelectorAll(".about-numbers [aria-hidden]"),
  ).toHaveLength(2);
  expect(container.querySelector(".about-numbers")?.textContent).toBe(
    "5枚 · 配布場所 1か所（地図に位置あり） · 2000-01-01時点",
  );
});
