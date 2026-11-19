import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AboutPage } from "./about-page";

afterEach(cleanup);

it("links to the privacy policy from the public usage section", () => {
  render(<AboutPage />);
  const usage = screen.getByRole("region", { name: "ご利用にあたって" });
  const policy = within(usage).getByRole("link", {
    name: "規約とプライバシーポリシー",
  });
  expect(policy.getAttribute("href")).toBe("/terms");
});
