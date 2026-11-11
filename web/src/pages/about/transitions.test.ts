import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutLid } from "./about-lid";
it("手帳の線画は2KB以内に収める", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  expect(Buffer.byteLength(html)).toBeLessThanOrEqual(2048);
});

it("閉じた表紙を右ページの後に描き、めくる間は右ページを隠す", () => {
  const html = renderToStaticMarkup(createElement(AboutLid));
  // Painted after the right page and filled, so the turning cover hides it.
  expect(html.indexOf('class="about-notebook-right"')).toBeLessThan(
    html.indexOf('class="about-notebook-cover"'),
  );
});
