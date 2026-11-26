import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  floatingDetail,
  narrowScreen,
  NARROW_WIDTH,
  SHORT_HEIGHT,
  UPRIGHT_WIDTH,
  WIDE_QUERY,
} from "./screen-shape";

// Every stylesheet of the map, wherever its rules move to.
const MAP_CSS = ["../../pages/map/", "./"].flatMap((dir) => {
  const url = new URL(dir, import.meta.url);
  return readdirSync(url)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(new URL(name, url), "utf8"));
});
const queries = MAP_CSS.flatMap((css) =>
  [...css.replaceAll(/\/\*[\s\S]*?\*\//g, "").matchAll(/@media([^{]+)\{/g)]
    .map((match) => match[1].trim().replaceAll(/\s+/g, " "))
    .filter((query) => /width|height/.test(query)),
);

type Feature = { side: "min" | "max"; axis: "width" | "height"; px: number };
const features = (query: string) =>
  query.split(", ").map((part) =>
    part.split(" and ").map((feature): Feature => {
      const match = /^\((min|max)-(width|height): (\d+)px\)$/.exec(feature);
      if (!match) throw new Error(`unread media feature: ${feature}`);
      return {
        side: match[1] as Feature["side"],
        axis: match[2] as Feature["axis"],
        px: Number(match[3]),
      };
    }),
  );
const applies = (query: string, width: number, height: number) =>
  features(query).some((all) =>
    all.every(({ side, axis, px }) => {
      const size = axis === "width" ? width : height;
      return side === "min" ? size >= px : size <= px;
    }),
  );

// The shapes the TypeScript decides, and the two the CSS alone lays out.
const SHAPES: Record<string, (width: number, height: number) => boolean> = {
  narrow: (width) => narrowScreen(width),
  wide: (width) => !narrowScreen(width),
  floating: floatingDetail,
  "short landscape": (width, height) =>
    height <= SHORT_HEIGHT && width >= UPRIGHT_WIDTH,
  "narrow or short": (width, height) =>
    narrowScreen(width) || height <= SHORT_HEIGHT,
};
// Each side of every number either file names.
const edges = [
  0,
  4000,
  ...[NARROW_WIDTH, SHORT_HEIGHT, UPRIGHT_WIDTH]
    .concat(
      queries.flatMap((q) =>
        features(q)
          .flat()
          .map(({ px }) => px),
      ),
    )
    .flatMap((px) => [px - 1, px, px + 1]),
];
const shapeOf = (query: string) =>
  Object.keys(SHAPES).find((name) =>
    edges.every((width) =>
      edges.every(
        (height) =>
          SHAPES[name](width, height) === applies(query, width, height),
      ),
    ),
  );

it("lays the map out in CSS on the shapes the TypeScript decides", () => {
  expect(queries.filter((query) => !shapeOf(query))).toEqual([]);
  expect(new Set(queries.map(shapeOf))).toEqual(new Set(Object.keys(SHAPES)));
});

// map-search.tsx follows this query to know when style.css lays out a desktop.
it("watches the query the desktop layout is written in", () => {
  expect(queries).toContain(WIDE_QUERY);
  expect(shapeOf(WIDE_QUERY)).toBe("wide");
});
