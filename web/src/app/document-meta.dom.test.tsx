import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  applyDocumentMeta,
  readDocumentMeta,
  screenMeta,
} from "./document-meta";

// The head a switch writes is the one the screen's own HTML carries.
it.each([
  ["map", "index.html"],
  ["catalog", "cards.html"],
] as const)("the %s screen's head matches %s", (route, file) => {
  const html = readFileSync(file, "utf8");
  document.head.innerHTML = new DOMParser().parseFromString(
    html.replaceAll("__CARD_COUNT__", "1313"),
    "text/html",
  ).head.innerHTML;
  const meta = screenMeta[route](1313);
  expect(readDocumentMeta()).toEqual(meta);
  const title = document.querySelector('meta[property="og:title"]');
  expect(title?.getAttribute("content")).toBe(meta.title);
  expect(
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute("content"),
  ).toBe(meta.description);
  expect(
    document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
  ).toBe(meta.url);
  // Written over the other screen's head, every field follows.
  applyDocumentMeta(screenMeta[route === "map" ? "catalog" : "map"](1313));
  applyDocumentMeta(meta);
  expect(readDocumentMeta()).toEqual(meta);
  expect(title?.getAttribute("content")).toBe(meta.title);
});
