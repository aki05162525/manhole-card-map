import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { HistoryRoute } from "../shared/browser/app-history";
import {
  applyDocumentMeta,
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
