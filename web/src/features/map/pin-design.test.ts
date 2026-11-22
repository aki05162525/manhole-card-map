import { afterEach, expect, it, vi } from "vitest";
import { installMapResources } from "./map-resources";
import { fakeMapLibre } from "./fake-maplibre";
import { mapPalette } from "./map-theme";

afterEach(() => {
  vi.unstubAllEnvs();
});
/**
 * An image as rows of characters, one per pixel: each colour's name from
 * `ink`, and a space where nothing is drawn.
 */
function picture(
  image: { width: number; height: number; data: Uint8Array },
  ink: Record<string, string>,
) {
  const hex = (value: number) => value.toString(16).padStart(2, "0");
  return Array.from({ length: image.height }, (_, y) =>
    Array.from({ length: image.width }, (_, x) => {
      const [r, g, b, a] = image.data.slice(
        (y * image.width + x) * 4,
        (y * image.width + x) * 4 + 4,
      );
      if (a === 0) return " ";
      expect(a).toBe(255);
      return ink[`#${hex(r)}${hex(g)}${hex(b)}`] ?? "?";
    }).join(""),
  );
}
/** Every pixel drawn twice each way, as an image for a 2x screen is. */
const doubled = (rows: string[]) =>
  rows.flatMap((row) => {
    const wide = row.replaceAll(/./g, (pixel) => pixel + pixel);
    return [wide, wide];
  });
const times = (count: number, row: string) =>
  Array.from({ length: count }, () => row);

const noPins = {
  pins: [],
  selectedPins: [],
  focus: { area: null, pref: null },
};
const noCounts = { areas: {}, prefs: {} };
// A 16px symbol in the status colour with a 2px rim of the theme's: filled,
// hollow for a distribution that has ended or is unknown, half for a suspended one.
const rim = "....................";
const edge = "..################..";
const shapes = {
  filled: [...times(2, rim), ...times(16, edge), ...times(2, rim)],
  hollow: [
    ...times(2, rim),
    ...times(2, edge),
    ...times(12, "..##............##.."),
    ...times(2, edge),
    ...times(2, rim),
  ],
  half: [
    ...times(2, rim),
    ...times(2, edge),
    ...times(12, "..########......##.."),
    ...times(2, edge),
    ...times(2, rim),
  ],
};
it.each([false, true])(
  "draws each status as its own shape, and redraws them for the other theme (dark=%s)",
  async (dark) => {
    const { repaintMapResources } = await import("./map-resources");
    // A style without glyphs: no count labels.
    const fake = fakeMapLibre({ zoom: 14, width: 1440, glyphs: false });
    const drawnIn = (theme: boolean) => {
      const palette = mapPalette(theme);
      for (const [status, shape] of [
        ["active", shapes.filled],
        ["upcoming", shapes.filled],
        ["suspended", shapes.half],
        ["ended", shapes.hollow],
        ["unknown", shapes.hollow],
      ] as const)
        expect([
          status,
          picture(fake.images.get(`card-square-${status}`)!, {
            [palette.pins[status]]: "#",
            [palette.pinRim]: ".",
          }),
        ]).toEqual([status, doubled(shape)]);
    };
    installMapResources(fake.maplibre, noPins, noCounts, dark);
    drawnIn(dark);
    repaintMapResources(fake.maplibre, !dark);
    drawnIn(!dark);
    expect(
      fake.layer("symbol", "card-pins-place").layout?.["icon-image"],
    ).toEqual(["concat", "card-square-", ["get", "status"]]);
    expect(fake.layers.has("card-count-values")).toBe(false);
    expect(fake.layers.has("card-count-names-area")).toBe(false);
    expect(fake.images.has("card-count-clearance")).toBe(false);
    expect(
      fake.layer("circle", "card-selection-outer").paint?.[
        "circle-stroke-color"
      ],
    ).toBe("#ffffff");
    expect(fake.errors).toEqual([]);
  },
);

it("marks a facility whose cards were received with a check, and one with some of them with a bar, only with accounts", () => {
  const install = () => {
    const fake = fakeMapLibre({ zoom: 14, width: 1440 });

    const resources = installMapResources(fake.maplibre, noPins, noCounts);
    return { fake, resources };
  };
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  const without = install();
  expect(without.fake.images.has("card-receipt-all")).toBe(false);
  expect(without.fake.layers.has("card-pins-receipt")).toBe(false);
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const { fake, resources } = install();
  // The runtime removes what it is told was added here.
  for (const [id, image, options] of vi.mocked(fake.maplibre.addImage).mock
    .calls) {
    if (!id.startsWith("card-receipt-")) continue;
    const ratio = options?.pixelRatio ?? 1;
    expect([image.width / ratio, image.height / ratio]).toEqual([16, 16]);
  }
  const ink = { "#1d1d1d": "#", "#ffffff": "." };
  expect(picture(fake.images.get("card-receipt-all")!, ink)).toEqual([
    "                                ",
    "           ##########           ",
    "        ################        ",
    "       #####........#####       ",
    "      ####............####      ",
    "     ###................###     ",
    "    ###..................###    ",
    "   ###....................###   ",
    "  ###.....................####  ",
    "  ###....................#####  ",
    "  ##....................###.##  ",
    " ###...................###..### ",
    " ##...#...............###....## ",
    " ##...##.............###.....## ",
    " ##...###...........###......## ",
    " ##....###.........###.......## ",
    " ##.....###.......###........## ",
    " ##......###.....###.........## ",
    " ##.......###...###..........## ",
    " ##........###.###...........## ",
    " ###........#####...........### ",
    "  ##.........###............##  ",
    "  ###........##............###  ",
    "  ###........#.............###  ",
    "   ###....................###   ",
    "    ###..................###    ",
    "     ###................###     ",
    "      ####............####      ",
    "       #####........#####       ",
    "        ################        ",
    "           ##########           ",
    "                                ",
  ]);
  expect(picture(fake.images.get("card-receipt-some")!, ink)).toEqual([
    "                                ",
    "           ##########           ",
    "        ################        ",
    "       #####........#####       ",
    "      ####............####      ",
    "     ###................###     ",
    "    ###..................###    ",
    "   ###....................###   ",
    "  ###......................###  ",
    "  ###......................###  ",
    "  ##........................##  ",
    " ###........................### ",
    " ##..........................## ",
    " ##..........................## ",
    " ##.....################.....## ",
    " ##.....################.....## ",
    " ##.....################.....## ",
    " ##.....################.....## ",
    " ##..........................## ",
    " ##..........................## ",
    " ###........................### ",
    "  ##........................##  ",
    "  ###......................###  ",
    "  ###......................###  ",
    "   ###....................###   ",
    "    ###..................###    ",
    "     ###................###     ",
    "      ####............####      ",
    "       #####........#####       ",
    "        ################        ",
    "           ##########           ",
    "                                ",
  ]);
  for (const source of ["card-pins", "card-selected"]) {
    const layer = fake.layer("symbol", `${source}-receipt`);
    expect(layer.source).toBe(source);
    // Only on facilities, and only where something was received.
    expect(layer.filter).toEqual([
      "all",
      ["==", ["get", "kind"], "place"],
      ["in", ["get", "receipt"], ["literal", ["all", "some"]]],
    ]);
    expect(layer.layout?.["icon-image"]).toEqual([
      "concat",
      "card-receipt-",
      ["get", "receipt"],
    ]);
    // The mark sits above and to the right of its pin; neither hides the other.
    const offset = layer.layout?.["icon-offset"];
    expect(Array.isArray(offset) && offset[0]).toBeGreaterThan(0);
    expect(Array.isArray(offset) && offset[1]).toBeLessThan(0);
    expect(layer.layout?.["icon-allow-overlap"]).toBe(true);
    expect(layer.layout?.["icon-ignore-placement"]).toBe(true);
  }
  resources.remove();
  expect(fake.images.size).toBe(0);
  expect(fake.errors).toEqual([]);
});

it.each([false, true])(
  "pulses the selection ring with a native 180ms paint transition (reduced=%s)",
  async (reduced) => {
    const { animateSelectionRing } = await import("./map-resources");
    const fake = fakeMapLibre();
    installMapResources(fake.maplibre, noPins, noCounts);
    const rings = () =>
      ["card-selection-ring", "card-selection-outer"].map((id) => {
        const paint: Record<string, unknown> = {
          ...fake.layer("circle", id).paint,
        };
        return [paint["circle-radius"], paint["circle-radius-transition"]];
      });
    const rendering = () => fake.listeners.get("render")?.size ?? 0;
    const at = (duration: number) => ({ duration, delay: 0 });
    animateSelectionRing(fake.maplibre, reduced);
    expect(rings()).toEqual(
      reduced
        ? [
            [18, at(0)],
            [21, at(0)],
          ]
        : [
            [24, at(0)],
            [27, at(0)],
          ],
    );
    expect(rendering()).toBe(reduced ? 0 : 1);
    fake.emit("render");
    expect(rings()).toEqual(
      reduced
        ? [
            [18, at(0)],
            [21, at(0)],
          ]
        : [
            [18, at(180)],
            [21, at(180)],
          ],
    );
    expect(rendering()).toBe(0);
    expect(fake.errors).toEqual([]);
  },
);
it("a cancelled pulse leaves the ring wide and listens no more", async () => {
  const { animateSelectionRing } = await import("./map-resources");
  const fake = fakeMapLibre();
  installMapResources(fake.maplibre, noPins, noCounts);
  animateSelectionRing(fake.maplibre, false)();
  fake.emit("render");
  expect(
    fake.layer("circle", "card-selection-ring").paint?.["circle-radius"],
  ).toBe(24);
  expect(
    fake.layer("circle", "card-selection-outer").paint?.["circle-radius"],
  ).toBe(27);
  expect(fake.listeners.get("render")?.size).toBe(0);
});

it("labels area and prefecture badges with place names only, and their circles with the count", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts);
  const values = fake.layer("symbol", "card-count-values").layout;
  expect(values?.["text-size"]).toEqual(["get", "valueSize"]);
  expect(values?.["text-field"]).toEqual(["to-string", ["get", "count"]]);
  for (const kind of ["area", "pref"]) {
    const names = fake.layer("symbol", `card-count-names-${kind}`);
    expect(names.layout?.["text-field"]).toEqual(["get", "name"]);
    expect(names.filter).toEqual(["==", ["get", "kind"], kind]);
  }
  // An area's name is placed in ems of this size (area-layout.test.ts), and
  // a prefecture's is smaller.
  const size = (kind: string) =>
    Number(
      fake.layer("symbol", `card-count-names-${kind}`).layout?.["text-size"],
    );
  expect(size("area")).toBe(13);
  expect(size("pref")).toBeLessThan(13);
});

it("E1 reserves collision space for badges and lets all area labels avoid it", () => {
  const fake = fakeMapLibre({ width: 1440 });

  const resources = installMapResources(fake.maplibre, noPins, noCounts);
  for (const kind of ["area", "pref"]) {
    const layout = fake.layer("symbol", `card-count-names-${kind}`).layout;
    if (kind === "pref") {
      expect(layout?.["text-allow-overlap"]).toBe(false);
      expect(layout?.["text-variable-anchor"]).toEqual([
        "top",
        "bottom",
        "right",
        "left",
      ]);
      expect(layout?.["text-radial-offset"]).toBeGreaterThanOrEqual(2);
    } else {
      expect(layout?.["text-allow-overlap"]).toBe(true);
      expect(layout?.["icon-allow-overlap"]).toBe(true);
      expect(layout?.["text-variable-anchor"]).toBeUndefined();
      expect(layout?.["text-anchor"]).toEqual(["get", "labelAnchor"]);
      expect(layout?.["text-offset"]).toEqual(["get", "labelOffset"]);
    }
  }
  const order = [...fake.layers.keys()];
  expect(order.indexOf("card-count-names-area")).toBeLessThan(
    order.indexOf("card-count-values"),
  );
  const values = fake.layer("symbol", "card-count-values").layout;
  expect(values?.["icon-ignore-placement"]).toBe(false);
  // The space is an image with nothing drawn, which the map removes later.
  const clearance = fake.images.get("card-count-clearance")!;
  expect(values?.["icon-image"]).toBe("card-count-clearance");
  expect([clearance.width, clearance.height]).toEqual([64, 64]);
  expect(clearance.data).toEqual(new Uint8Array(64 * 64 * 4));
  resources.remove();
  expect(fake.images.has("card-count-clearance")).toBe(false);
});

/** A count badge's zoom-dependent size, as MapLibre evaluates it. */
function sized(
  expression: unknown,
  zoom: number,
  properties: { kind: string; radius: number },
) {
  const evaluate = (value: any): any => {
    if (!Array.isArray(value)) return value;
    const [op, ...args] = value;
    if (op === "get") {
      if (!(args[0] in properties)) throw Error(`no property ${args[0]}`);
      return properties[args[0] as keyof typeof properties];
    }
    if (op === "zoom") return zoom;
    if (op === "==") return evaluate(args[0]) === evaluate(args[1]);
    if (op === "case")
      return evaluate(args[0]) ? evaluate(args[1]) : evaluate(args[2]);
    if (op === "max") return Math.max(...args.map(evaluate));
    if (op === "*") return evaluate(args[0]) * evaluate(args[1]);
    if (op === "-") return evaluate(args[0]) - evaluate(args[1]);
    if (op === "/") return evaluate(args[0]) / evaluate(args[1]);
    if (op === "interpolate") {
      const z = evaluate(args[1]);
      if (z <= args[2]) return evaluate(args[3]);
      for (let i = 4; i < args.length; i += 2)
        if (z < args[i]) {
          const t = (z - args[i - 2]) / (args[i] - args[i - 2]);
          return evaluate(args[i - 1]) * (1 - t) + evaluate(args[i + 1]) * t;
        }
      return evaluate(args.at(-1));
    }
    throw Error(op);
  };
  return evaluate(expression);
}
it("draws national badges at their full size at every zoom, and prefecture badges growing into theirs", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts);
  const circle = fake.layer("circle", "card-level-counts").paint?.[
    "circle-radius"
  ];
  const inner = fake.layer("circle", "card-count-inner").paint?.[
    "circle-radius"
  ];
  const space = fake.layer("symbol", "card-count-values").layout?.["icon-size"];
  for (const zoom of [2, 3.85, 4.1, 6])
    for (const radius of [16, 18, 26]) {
      const area = { kind: "area", radius };
      expect(sized(circle, zoom, area)).toBeCloseTo(radius);
      // The inner ring lies 4px inside, and the 64px image keeps other
      // labels off the circle and its 2px rim.
      expect(sized(inner, zoom, area)).toBeCloseTo(radius - 4);
      expect(32 * sized(space, zoom, area)).toBeGreaterThanOrEqual(radius + 2);
      expect(32 * sized(space, zoom, area)).toBeLessThanOrEqual(radius + 4);
    }
  const pref = { kind: "pref", radius: 20 };
  expect(sized(circle, 2, pref)).toBeCloseTo(5);
  expect(sized(circle, 4, pref)).toBeCloseTo(12);
  expect(sized(circle, 5, pref)).toBeCloseTo(16);
  expect(sized(circle, 6, pref)).toBeCloseTo(20);
  expect(sized(circle, 9, pref)).toBeCloseTo(20);
  // A badge too small for its inner ring has none, not a negative one.
  expect(sized(inner, 2, { kind: "pref", radius: 12 })).toBe(0);
});

it("draws selected pins larger, over a ring, each kind on its own layer", () => {
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts);
  const order = [...fake.layers.keys()];
  for (const ring of ["card-selection-outer", "card-selection-ring"]) {
    expect(fake.layer("circle", ring).source).toBe("card-selected");
    expect(order.indexOf(ring)).toBeGreaterThan(
      order.indexOf("card-pins-place"),
    );
    expect(order.indexOf(ring)).toBeLessThan(
      order.indexOf("card-selected-lid"),
    );
  }
  const lid = (source: string) => fake.layer("circle", `${source}-lid`);
  const place = (source: string) => fake.layer("symbol", `${source}-place`);
  for (const source of ["card-pins", "card-selected"]) {
    expect(lid(source).source).toBe(source);
    expect(lid(source).filter).toEqual(["==", ["get", "kind"], "lid"]);
    expect(lid(source).paint?.["circle-color"]).toEqual(["get", "color"]);
    expect(place(source).source).toBe(source);
    expect(place(source).filter).toEqual(["==", ["get", "kind"], "place"]);
  }
  expect(lid("card-selected").paint?.["circle-radius"]).toBeGreaterThan(
    Number(lid("card-pins").paint?.["circle-radius"]),
  );
  expect(place("card-selected").layout?.["icon-size"]).toBeGreaterThan(
    Number(place("card-pins").layout?.["icon-size"]),
  );
});

it.each([false, true])(
  "paints every themed layer from the palette, and again for the other theme (dark=%s)",
  async (dark) => {
    const { repaintMapResources } = await import("./map-resources");
    const fake = fakeMapLibre({ width: 1440 });
    installMapResources(fake.maplibre, noPins, noCounts, dark);
    const painted = () => {
      const paint = (id: string, key: string) => {
        const layer = fake.layers.get(id);
        const values: Record<string, unknown> = { ...layer?.paint };
        return values[key];
      };
      return {
        water: [paint("japan-mask", "fill-color")],
        iron: [
          paint("card-level-counts", "circle-color"),
          paint("card-current-halo", "circle-color"),
        ],
        paper: [
          paint("card-level-counts", "circle-stroke-color"),
          paint("card-count-names-area", "text-halo-color"),
          paint("card-count-names-pref", "text-halo-color"),
        ],
        inner: [paint("card-count-inner", "circle-stroke-color")],
        onIron: [paint("card-count-values", "text-color")],
        ink: [
          paint("card-count-names-area", "text-color"),
          paint("card-count-names-pref", "text-color"),
        ],
        selection: [
          paint("card-selection-ring", "circle-stroke-color"),
          paint("card-current-location", "circle-color"),
        ],
      };
    };
    const themed = (theme: boolean) => {
      const palette = mapPalette(theme);
      return Object.fromEntries(
        Object.entries(painted()).map(([colour, layers]) => [
          colour,
          layers.map(() => palette[colour as keyof typeof palette]),
        ]),
      );
    };
    expect(painted()).toEqual(themed(dark));
    repaintMapResources(fake.maplibre, !dark);
    expect(painted()).toEqual(themed(!dark));
    expect(fake.errors).toEqual([]);
  },
);

it("adds no image the style already has, and does not claim it for removal", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const fake = fakeMapLibre({ width: 1440 });
  const kept = { width: 1, height: 1, data: new Uint8Array(4) };
  for (const id of [
    "card-count-clearance",
    "card-square-active",
    "card-receipt-all",
  ])
    fake.maplibre.addImage(id, kept);
  const resources = installMapResources(fake.maplibre, noPins, noCounts);
  resources.remove();
  expect(fake.errors).toEqual([]);
  expect([...fake.images.keys()].sort()).toEqual([
    "card-count-clearance",
    "card-receipt-all",
    "card-square-active",
  ]);
  expect(fake.images.get("card-square-active")).toBe(kept);
});

it("repaints what the style still has: a lost image is not a map error", async () => {
  const { repaintMapResources } = await import("./map-resources");
  const fake = fakeMapLibre({ width: 1440 });
  installMapResources(fake.maplibre, noPins, noCounts);
  fake.maplibre.removeImage("card-square-ended");
  repaintMapResources(fake.maplibre, true);
  expect(fake.errors).toEqual([]);
  expect(fake.images.has("card-square-ended")).toBe(false);
  expect(fake.map.updateImage).toHaveBeenCalledTimes(4);
});
