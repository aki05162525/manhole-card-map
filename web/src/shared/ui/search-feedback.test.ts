import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { PinReason } from "../../domain/card-catalog";
import { SearchEmptyState, SearchPin } from "./search-feedback";

it.each<[boolean, PinReason[], string]>([
  [true, ["partial"], "地図にピンあり"],
  [false, ["relation-review", "no-facility"], "ピンなし・未確認"],
  [false, ["no-facility", "location-unconfirmed"], "ピンなし・配布場所未登録"],
  [false, ["location-unconfirmed"], "ピンなし・位置未確定"],
])(
  "says whether the map has a pin (%s) and, for %j, why not: %s",
  (hasPin, pinReasons, text) => {
    const html = renderToStaticMarkup(
      createElement(SearchPin, { entry: { hasPin, pinReasons } }),
    );
    expect(html.endsWith(`<span>${text}</span></span>`)).toBe(true);
    // A filled square for a pin, an empty one for none.
    expect(/<rect[^>]* fill="(\w+)"/.exec(html)?.[1]).toBe(
      hasPin ? "currentColor" : "none",
    );
  },
);

it.each([
  ["三島", "『三島』に一致するカードはありません"],
  ["", "この地域のカードはまだ登録されていません"],
])("explains an empty result for the query %j", (query, title) => {
  const html = renderToStaticMarkup(
    createElement(SearchEmptyState, {
      query,
      regionHref: "/cards?pref=22",
      headingId: "empty",
    }),
  );
  // The heading takes focus from a script, without joining the tab order.
  expect(html).toContain(
    `<h2 id="empty" tabindex="-1" class="search-empty-title">${title}</h2>`,
  );
  expect(html).toContain('<a href="/cards?pref=22">');
});
