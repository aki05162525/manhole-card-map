import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AboutPage } from "./about-page";

afterEach(cleanup);
it("h1は1つで、装飾は支援技術から隠す", () => {
  const { container } = render(<AboutPage />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(container.querySelectorAll(".about-sr-only")).toHaveLength(1);
  expect(
    container.querySelector(".about-catch")?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(
    container.querySelector(".about-lid")?.getAttribute("aria-hidden"),
  ).toBe("true");
});
