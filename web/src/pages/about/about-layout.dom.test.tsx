import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AboutLid } from "./about-lid";
import { AboutPage } from "./about-page";
import { summarizeAbout } from "./about-summary";
import { fixtureData } from "../../../scripts/fixtures";

afterEach(() => {
  cleanup();
  document.head.replaceChildren();
});
it("刻印は1行のまま列幅を確保し、件数の区切りと括弧を保持する", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/pages/about/about.css", "utf8").replace(
    /@import[^;]+;/g,
    "",
  );
  document.head.append(style);
  const { container } = render(
    <AboutPage summary={summarizeAbout(fixtureData)} />,
  );
  for (const number of container.querySelectorAll(".about-step-number"))
    expect(getComputedStyle(number).whiteSpace).toBe("nowrap");
  expect(
    getComputedStyle(container.querySelector(".about-step")!)
      .gridTemplateColumns,
  ).toBe("max-content minmax(0px, 1fr)");
  expect(
    container.querySelectorAll(".about-numbers [aria-hidden]"),
  ).toHaveLength(2);
  for (const separator of container.querySelectorAll(
    ".about-numbers [aria-hidden]",
  ))
    expect(getComputedStyle(separator).display).not.toBe("none");
  expect(
    getComputedStyle(container.querySelector(".about-place-count")!).columnGap,
  ).toBe("0px");
  expect(container.querySelector(".about-numbers")?.textContent).toBe(
    "5枚 · 配布施設 1か所（地図に位置あり） · 2000-01-01時点",
  );
});

it("動きを許可しない既定CSSでは手帳の完成形を出し、閉じた表紙を残さない", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/pages/about/about.css", "utf8").replace(
    /@import[^;]+;/g,
    "",
  );
  document.head.append(style);
  // jsdom does not evaluate motion preferences; exclude the opt-in rules explicitly.
  const sheet = style.sheet!;
  for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
    const rule = sheet.cssRules[i];
    if (
      rule instanceof CSSMediaRule &&
      rule.conditionText === "(prefers-reduced-motion: no-preference)"
    )
      sheet.deleteRule(i);
  }
  const { container } = render(<AboutLid />);
  const cover = container.querySelector(".about-notebook-cover")!;
  expect(getComputedStyle(cover).opacity).toBe("0");
  for (const part of container.querySelectorAll(".about-lid *")) {
    const computed = getComputedStyle(part);
    expect(computed.animationName).toMatch(/^(none)?$/);
    if (!part.hasAttribute("transform"))
      expect(computed.transform).toMatch(/^(none)?$/);
    if (part !== cover) expect(computed.opacity).not.toBe("0");
    if (part.hasAttribute("pathLength"))
      expect(computed.strokeDasharray).toMatch(/^(none)?$/);
  }
});
