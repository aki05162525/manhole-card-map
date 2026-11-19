import { afterEach, expect, it, vi } from "vitest";
import { mapPalette, systemDark, watchMapTheme } from "./map-theme";
import {
  contrastRatio,
  composite,
} from "../../../../tools/design/color-contrast.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
});
/** Changing the OS scheme dispatches the browser's media query event. */
function osScheme(dark: boolean) {
  const media = Object.assign(new EventTarget(), { matches: dark });
  return {
    media,
    set(next: boolean) {
      media.matches = next;
      media.dispatchEvent(new Event("change"));
    },
    /** A window whose only dark-scheme query answers with this scheme. */
    window: {
      matchMedia: (query: string) =>
        query === "(prefers-color-scheme: dark)"
          ? media
          : osScheme(false).media,
    },
  };
}
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
it("paints the current scheme, then each change until it is stopped", () => {
  const os = osScheme(true);
  const paint = vi.fn();
  const stop = watchMapTheme(paint, os.media);
  expect(paint.mock.calls).toEqual([[true]]);
  os.set(false);
  os.set(true);
  expect(paint.mock.calls).toEqual([[true], [false], [true]]);
  stop();
  os.set(false);
  expect(paint).toHaveBeenCalledTimes(3);
});
it("reads and watches the OS scheme itself, and is light where there is no window", () => {
  // A prerender, as these tests, has no window.
  expect(systemDark()).toBe(false);
  const os = osScheme(true);
  vi.stubGlobal("window", os.window);
  expect(systemDark()).toBe(true);
  const paint = vi.fn();
  watchMapTheme(paint)();
  expect(paint.mock.calls).toEqual([[true]]);
  vi.stubGlobal("window", osScheme(false).window);
  expect(systemDark()).toBe(false);
});
it.each([false, true])(
  "rings a count badge inside with its number's colour at half strength (dark=%s)",
  (dark) => {
    const p = mapPalette(dark);
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(p.onIron.slice(i, i + 2), 16),
    );
    expect(p.inner).toBe(`rgba(${r},${g},${b},0.5)`);
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

it("separates dark land and water by at least 1.2:1", () => {
  const p = mapPalette(true);
  expect(contrastRatio(p.land, p.water)).toBeGreaterThanOrEqual(1.2);
});

it.each(["light", "dark"] as const)(
  "audits the actual %s source palette without duplicated colors",
  async (theme) => {
    const { readMapPalette } =
      await import("../../../../tools/design/theme-contrast.mjs");
    expect(mapPalette(theme === "dark")).toMatchObject(readMapPalette(theme));
  },
);
