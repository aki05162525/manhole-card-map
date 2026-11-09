import { expect, it, vi } from "vitest";
import { mapPalette, watchMapTheme } from "./map-theme";
import {
  contrastRatio,
  composite,
} from "../../../../tools/design/color-contrast.mjs";
import { transformBasemapStyle, basemapRepaint } from "./basemap-style";
import type { StyleSpecification } from "maplibre-gl";
it.each([false, true])(
  "keeps map labels, boundaries, pins and controls legible on every surface (dark=%s)",
  (dark) => {
    const p = mapPalette(dark);
    for (const bg of [
      p.land,
      p.water,
      p.building,
      p.green,
      p.road,
      p.roadEdge,
    ]) {
      // The existing light road casing is behind the paper-colored text halo.
      // Dark labels also meet contrast directly on every map surface.
      const textBackground = !dark && bg === p.roadEdge ? p.paper : bg;
      expect(contrastRatio(p.label, textBackground)).toBeGreaterThanOrEqual(
        4.5,
      );
      if (dark)
        for (const color of Object.values(p.pins))
          expect(
            contrastRatio(composite(color, bg, p.inactivePinOpacity), bg),
          ).toBeGreaterThanOrEqual(3);
      for (const fg of [
        p.boundary,
        p.iron,
        p.selection,
        ...(dark ? ["#ffffff"] : []),
        ...Object.values(p.pins),
      ])
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
    }
    for (const color of Object.values(p.pins))
      expect(contrastRatio(color, p.pinRim)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.onIron, p.iron)).toBeGreaterThanOrEqual(4.5);
  },
);
it("recolors dark basemap surfaces and labels without changing the input or adding duplicate road edges", () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: "land", type: "background" },
      { id: "water", type: "fill", source: "v", "source-layer": "water" },
      { id: "label", type: "symbol", source: "v", "source-layer": "water" },
      { id: "road", type: "line", source: "v", "source-layer": "roads" },
    ],
  } as StyleSpecification;
  const next = transformBasemapStyle(style, true);
  expect(next.layers[0].paint).toMatchObject({
    "background-color": mapPalette(true).land,
  });
  expect(next.layers[1].paint).toMatchObject({
    "fill-color": mapPalette(true).water,
  });
  expect(next.layers[2].paint).toMatchObject({
    "text-color": mapPalette(true).label,
  });
  expect(next.layers).toHaveLength(5);
  expect(style.layers[0].paint).toBeUndefined();
});
it("subscribes once, paints the current scheme, handles both changes and unsubscribes", () => {
  let change: () => void = () => {};
  const media = {
    matches: true,
    addEventListener: vi.fn((_event, fn) => {
      change = fn;
    }),
    removeEventListener: vi.fn(),
  };
  const paint = vi.fn();
  const stop = watchMapTheme(paint, media as unknown as MediaQueryList);
  expect(paint).toHaveBeenLastCalledWith(true);
  media.matches = false;
  change();
  expect(paint).toHaveBeenLastCalledWith(false);
  expect(media.addEventListener).toHaveBeenCalledTimes(1);
  stop();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", change);
});

it("repaints only recognized basemap paint, preserves roads and app layers, and keeps light boundaries unchanged", async () => {
  const { basemapRepaint } = await import("./basemap-style");
  const style = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "road-cast-iron-edge",
        type: "line",
        source: "v",
        "source-layer": "roads",
        paint: { "line-width": 0.75 },
      },
      {
        id: "boundary_state",
        type: "line",
        source: "v",
        "source-layer": "boundaries",
        paint: { "line-color": "#ead5d7" },
      },
      {
        id: "boundary_country_outline",
        type: "line",
        source: "v",
        "source-layer": "boundaries",
        paint: { "line-color": "#f3efed" },
      },
      {
        id: "app",
        type: "circle",
        source: "app",
        paint: { "circle-color": "#123456" },
      },
    ],
  } as StyleSpecification;
  const setPaintProperty = vi.fn();
  const repaint = basemapRepaint({
    getStyle: () => style,
    setPaintProperty,
  } as never);
  repaint(true);
  expect(setPaintProperty).toHaveBeenCalledWith(
    "road-cast-iron-edge",
    "line-color",
    mapPalette(true).roadEdge,
  );
  expect(setPaintProperty).toHaveBeenCalledWith(
    "boundary_state",
    "line-color",
    mapPalette(true).boundary,
  );
  expect(setPaintProperty).toHaveBeenCalledWith(
    "boundary_country_outline",
    "line-color",
    mapPalette(true).land,
  );
  expect(setPaintProperty.mock.calls.some(([id]) => id === "app")).toBe(false);
  repaint(false);
  expect(setPaintProperty).toHaveBeenCalledWith(
    "boundary_country_outline",
    "line-color",
    "#f3efed",
  );
  expect(
    transformBasemapStyle(style, false).layers.find(
      (l) => l.id === "boundary_state",
    )?.paint,
  ).toEqual({ "line-color": "#ead5d7" });
});

it.each([false, true])(
  "restores provider fill outlines after an OS round trip (initial dark=%s)",
  (dark) => {
    const base = {
      version: 8,
      sources: {},
      layers: [
        {
          id: "building",
          type: "fill",
          source: "v",
          "source-layer": "buildings",
          paint: { "fill-color": "#eeeeee", "fill-outline-color": "#dddddd" },
        },
      ],
    } as StyleSpecification;
    let style = transformBasemapStyle(base, dark);
    const map = {
      getStyle: () => style,
      setPaintProperty: (id: string, key: string, value: unknown) => {
        style = {
          ...style,
          layers: style.layers.map((l) =>
            l.id === id ? { ...l, paint: { ...l.paint, [key]: value } } : l,
          ),
        } as StyleSpecification;
      },
    };
    const repaint = basemapRepaint(map as never);
    repaint(!dark);
    repaint(dark);
    repaint(false);
    expect(style.layers[0].paint).toMatchObject({
      "fill-color": mapPalette(false).building,
      "fill-outline-color": "#dddddd",
    });
  },
);

it.each(["light", "dark"] as const)(
  "mirrors CSS tokens in the %s WebGL palette",
  async (theme) => {
    const { readThemeTokens } =
      await import("../../../../tools/design/theme-contrast.mjs");
    const tokens = readThemeTokens(theme);
    const p = mapPalette(theme === "dark");
    const full = (value: string) =>
      value.length === 4
        ? "#" +
          value
            .slice(1)
            .split("")
            .map((v) => v + v)
            .join("")
        : value;
    for (const [token, color] of Object.entries({
      iron: p.iron,
      "on-iron": p.onIron,
      paper: p.paper,
      boundary: p.boundary,
      ...Object.fromEntries(
        Object.entries(p.pins)
          .filter(([status]) => status !== "ended")
          .map(([status, color]) => [`${status}-pin`, color]),
      ),
    }))
      expect(full(tokens[token])).toBe(full(color));
  },
);

it("separates dark land and water by at least 1.2:1 while keeping water labels legible", () => {
  const p = mapPalette(true);
  expect(contrastRatio(p.land, p.water)).toBeGreaterThanOrEqual(1.2);
  expect(contrastRatio(p.label, p.water)).toBeGreaterThanOrEqual(4.5);
});

it.each(["light", "dark"] as const)(
  "audits the actual %s source palette without duplicated colors",
  async (theme) => {
    const { readMapPalette } =
      await import("../../../../tools/design/theme-contrast.mjs");
    expect(mapPalette(theme === "dark")).toMatchObject(readMapPalette(theme));
  },
);
