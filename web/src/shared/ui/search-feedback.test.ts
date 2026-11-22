import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { PinReason } from "../../domain/card-catalog";
import { SearchEmptyState, SearchPin } from "./search-feedback";

// A pin is the rule and goes unsaid; only its absence is told, with why.
it.each<[boolean, PinReason[], string | null]>([
  [true, ["partial"], null],
  [false, ["relation-review", "no-facility"], "ピンなし・未確認"],
  [false, ["no-facility", "location-unconfirmed"], "ピンなし・配布場所未登録"],
  [false, ["location-unconfirmed"], "ピンなし・位置未確定"],
])("for a card with a pin (%s) and %j, says %s", (hasPin, pinReasons, text) => {
  const html = renderToStaticMarkup(
    createElement(SearchPin, { entry: { hasPin, pinReasons } }),
  );
  if (text === null) expect(html).toBe("");
  else expect(html.endsWith(`<span>${text}</span></span>`)).toBe(true);
});

it.each([
  ["三島", "「三島」に一致するカードはありません"],
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
