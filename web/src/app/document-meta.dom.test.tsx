import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { HistoryRoute } from "../shared/browser/app-history";
import { fixtureData } from "../../scripts/build/fixtures";
import { summarizeCatalog } from "../domain/catalog-summary";
import { renderCatalogPages } from "../pages/cards/static-catalog";
import {
  applyDocumentMeta,
  prefectureMeta,
  readDocumentMeta,
  screenMeta,
} from "./document-meta";

const content = (selector: string) =>
  document.querySelector(selector)?.getAttribute("content") ?? null;
const social = () => ({
  title: content('meta[property="og:title"]'),
  description: content('meta[property="og:description"]'),
  url: content('meta[property="og:url"]'),
});

// The head a switch writes is the one the screen's own HTML carries.
it.each([
  ["map", "index.html"],
  ["catalog", "cards.html"],
  ["friends", "friends.html"],
  ["account", "account.html"],
  ["about", "about.html"],
] as const)("the %s screen's head matches %s", (route, file) => {
  const html = readFileSync(file, "utf8");
  document.head.innerHTML = new DOMParser().parseFromString(
    html.replaceAll("__CARD_COUNT__", "1313"),
    "text/html",
  ).head.innerHTML;
  const meta = screenMeta[route](1313);
  expect(readDocumentMeta()).toEqual(meta);
  const tags = social();
  expect(tags).toEqual(
    meta.url
      ? { title: meta.title, description: meta.description, url: meta.url }
      : { title: null, description: null, url: null },
  );
  // Written over each other screen's head, every field follows.
  for (const other of Object.keys(screenMeta) as HistoryRoute[]) {
    applyDocumentMeta(screenMeta[other](1313));
    applyDocumentMeta(meta);
    expect(readDocumentMeta()).toEqual(meta);
    expect(social()).toEqual(tags);
  }
});

// A prefecture's list is the list's screen at a URL of its own: the head a
// switch or a choice writes is the one the build wrote into its HTML.
it.each([
  ["13", "tokyo"],
  ["27", "osaka"],
  // No card in the fixture: the description counts none.
  ["47", "okinawa"],
  ["other", "other"],
])("the list of prefecture %s has the head of /pref/%s/", (code, slug) => {
  const pages = renderCatalogPages(
    fixtureData,
    readFileSync("cards.html", "utf8"),
  );
  const page = new DOMParser().parseFromString(
    pages.get(`pref/${slug}/index.html`)!,
    "text/html",
  );
  document.head.innerHTML = page.head.innerHTML;
  const built = readDocumentMeta();
  const tags = social();
  expect(built.url).toBe(`https://manhole-techo.com/pref/${slug}/`);
  expect(tags).toEqual({
    title: built.title,
    description: built.description,
    url: built.url,
  });
  // The count is the one the build put on the list's root.
  const { totals } = summarizeCatalog(fixtureData);
  document.body.innerHTML = `<div id="root" data-catalog-totals="${Object.entries(
    totals,
  )
    .map(([code, total]) => `${code}:${total}`)
    .join(",")}"></div>`;
  expect(prefectureMeta(code)).toEqual(built);
  applyDocumentMeta(screenMeta.map(1313));
  applyDocumentMeta(prefectureMeta(code)!);
  expect(readDocumentMeta()).toEqual(built);
  expect(social()).toEqual(tags);
  // A document that is another screen's carries no count: the rest holds.
  document.body.innerHTML = '<div id="root"></div>';
  expect(prefectureMeta(code)).toEqual({
    ...built,
    description: built.description!.replace(/の\d+枚/, ""),
  });
});

it("reads the prefecture of the head from the URL shown, and none for the whole list", () => {
  history.replaceState(null, "", "/pref/tokyo/?q=a&page=2");
  expect(prefectureMeta()?.url).toBe("https://manhole-techo.com/pref/tokyo/");
  history.replaceState(null, "", "/cards?q=a");
  expect(prefectureMeta()).toBeNull();
});
