import { afterEach, expect, it, vi } from "vitest";

// Each test is a new document: the module keeps the document's loads.
const fresh = async () => {
  vi.resetModules();
  return import("./card-data");
};
const answer = (body: unknown) => new Response(JSON.stringify(body));

const envelope = { schema: 1, updated: "same" };
const full = { ...envelope, pins: [], cards: [], places: [], relations: [] };
const pins = { ...envelope, shards: ["13"], pins: [] };
const detail = { ...envelope, cards: [], places: [], relations: [] };
const search = { ...envelope, cards: [] };
const fileFor = (url: string) =>
  url.includes("detail-")
    ? detail
    : url.endsWith("pins.json")
      ? pins
      : url.endsWith("search.json")
        ? search
        : full;
const urls = (fetched: { mock: { calls: unknown[][] } }) =>
  fetched.mock.calls.map(([url]) => url);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("revalidates immutable files when the map reload button opens a new document", async () => {
  vi.stubGlobal("performance", {
    now: performance.now.bind(performance),
    mark: vi.fn(),
    getEntriesByType: () => [{ type: "reload" }],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) =>
      answer(init?.cache === "reload" ? fileFor(url) : {}),
    ),
  );
  const map = await fresh();
  await expect(map.sharedPins()).resolves.toEqual(pins);
});

it.each([
  {},
  { ...full, cards: null },
  { ...full, places: undefined },
  { ...full, relations: {} },
  { ...full, pins: null },
  { ...full, schema: 2 },
  { ...full, updated: "" },
  { ...full, cardAliases: [] },
])(
  "forgets malformed full data and accepts the next response",
  async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        answer(init?.cache === "reload" ? full : body),
      ),
    );
    const catalog = await fresh();
    await expect(catalog.sharedCardData()).rejects.toThrow();
    expect(catalog.loadedCardData()).toBeUndefined();
    await expect(catalog.sharedCardData()).resolves.toEqual(full);
  },
);

it.each([
  { ...pins, schema: 2 },
  { ...pins, shards: undefined },
  { ...pins, pins: null },
  { ...pins, cardAliases: [] },
])("rejects malformed pins before sharing them", async (body) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => answer(body)),
  );
  const map = await fresh();
  await expect(map.sharedPins()).rejects.toThrow();
  expect(map.loadedPins()).toBeUndefined();
});

it("reads the build's own data generation, which the browser may keep for good", async () => {
  vi.stubEnv("VITE_DATA_VERSION", "abc123");
  const fetched = vi.fn(async (url: string) => answer(fileFor(url)));
  vi.stubGlobal("fetch", fetched);
  await (await fresh()).sharedCardData();
  const map = await fresh();
  const loaded = await map.sharedPins();
  map.requestSearch();
  map.requestDetail("13");
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13"])).toBeTruthy(),
  );
  expect(urls(fetched)).toEqual([
    "/data-v/abc123/full.json",
    "/data-v/abc123/pins.json",
    "/data-v/abc123/search.json",
    "/data-v/abc123/detail-13.json",
  ]);
});

// A deployment that lacked this generation answered 404, and the browser
// keeps that answer as long as the data.
it("asks the server again when the kept answer is a failure", async () => {
  const fetched = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.cache === "reload"
      ? answer(full)
      : new Response("<!doctype html>", { status: 404 }),
  );
  vi.stubGlobal("fetch", fetched);
  await expect((await fresh()).sharedCardData()).resolves.toMatchObject({
    updated: "same",
  });
  expect(fetched).toHaveBeenCalledTimes(2);
});

it("gives the map its pins and reads nothing else until it is asked", async () => {
  const fetched = vi.fn(async (url: string) => answer(fileFor(url)));
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  const loaded = await map.sharedPins();
  expect(map.loadedPins()).toBe(loaded);
  expect(map.loadedCardData()).toBeUndefined();
  expect(map.loadedSearch()).toBeUndefined();
  expect(map.loadedDetails(loaded, ["13"])).toBeNull();
  expect(urls(fetched)).toEqual(["/data/pins.json"]);
});

it("reads each prefecture's details once, and joins those asked for into one data", async () => {
  const card = (id: string) => ({ id });
  const place = { id: "shared" };
  const files: Record<string, unknown> = {
    "/data/pins.json": {
      ...envelope,
      evaluatedAt: "2026-11-19",
      cardAliases: { old: "13-1" },
      shards: ["13", "14"],
      pins: [
        { id: "shared", cardIds: ["13-1", "14-1"] },
        { id: "other", cardIds: ["27-1"] },
      ],
    },
    "/data/detail-13.json": {
      ...detail,
      evaluatedAt: "2026-11-19",
      cards: [card("13-1")],
      places: [place],
      relations: [{ cardId: "13-1", placeId: "shared" }],
    },
    "/data/detail-14.json": {
      ...detail,
      evaluatedAt: "2026-11-19",
      cards: [card("14-1")],
      places: [place],
      relations: [{ cardId: "14-1", placeId: "shared" }],
    },
  };
  const fetched = vi.fn(async (url: string) => answer(files[url]));
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  const loaded = await map.sharedPins();
  const changes = vi.fn();
  map.subscribeData(changes);
  map.requestDetail("13");
  map.requestDetail("13");
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13"])).toBeTruthy(),
  );
  // One of the two has arrived: nothing is shown of a half.
  expect(map.loadedDetails(loaded, ["13", "14"])).toBeNull();
  map.requestDetail("14");
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13", "14"])).toBeTruthy(),
  );
  const data = map.loadedDetails(loaded, ["13", "14"]);
  expect(data).toEqual({
    ...envelope,
    evaluatedAt: "2026-11-19",
    cardAliases: { old: "13-1" },
    cards: [card("13-1"), card("14-1")],
    // The place both prefectures' cards share, once.
    places: [place],
    relations: [
      { cardId: "13-1", placeId: "shared" },
      { cardId: "14-1", placeId: "shared" },
    ],
    // The pins of these cards alone.
    pins: [{ id: "shared", cardIds: ["13-1", "14-1"] }],
  });
  // The same object for the same files: nothing is drawn again.
  expect(map.loadedDetails(loaded, ["13", "14"])).toBe(data);
  expect(urls(fetched)).toEqual([
    "/data/pins.json",
    "/data/detail-13.json",
    "/data/detail-14.json",
  ]);
  expect(changes).toHaveBeenCalledTimes(2);
});

it("holds no cards for a prefecture the pins do not list, whatever its request answered", async () => {
  const fetched = vi.fn(async (url: string) =>
    url.includes("detail-") ? new Response("", { status: 404 }) : answer(pins),
  );
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  // Asked with the pins, before they could say there is no such file.
  map.requestDetail("99");
  const loaded = await map.sharedPins();
  await vi.waitFor(() => expect(fetched).toHaveBeenCalledTimes(3));
  expect(map.loadedDetails(loaded, ["99"])).toMatchObject({ cards: [] });
});

// Under the plain URLs of fixture and dev, either date tells data made again.
it.each([{ updated: "new" }, { evaluatedAt: "2026-11-20" }])(
  "refuses a file whose dates are not those of the first file read: %o",
  async (dates) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        answer({
          ...fileFor(url),
          evaluatedAt: "2026-11-19",
          ...(url.includes("pins") ? {} : dates),
        }),
      ),
    );
    const map = await fresh();
    const loaded = await map.sharedPins();
    map.requestDetail("13");
    await vi.waitFor(() =>
      expect(map.loadedDetails(loaded, ["13"])).toBe("failed"),
    );
    map.requestSearch();
    await vi.waitFor(() => expect(map.searchFailed()).toBe("failed"));
    expect(map.loadedSearch()).toBeUndefined();
  },
);

it("gives the map its part of the full data the catalog has read, without a second fetch", async () => {
  const data = {
    ...full,
    cards: [{ id: "13-100-A001", city: "", pref: "" }],
    places: [
      { id: "shown", coordinate: { status: "confirmed" } },
      {
        id: "withdrawn",
        coordinate: { status: "confirmed" },
        locationReview: { status: "withdrawn" },
      },
    ],
    pins: [
      { id: "shown", kind: "place", cardIds: [] },
      { id: "withdrawn", kind: "place", cardIds: [] },
      { id: "lid:13-100-A001", kind: "lid", cardIds: ["13-100-A001"] },
    ],
  };
  const fetched = vi.fn(async () => answer(data));
  vi.stubGlobal("fetch", fetched);
  const catalog = await fresh();
  await catalog.sharedCardData();
  const loaded = await catalog.sharedPins();
  expect(loaded).toEqual({
    ...envelope,
    shards: ["13"],
    // A place whose position was withdrawn has no pin on the map.
    pins: [data.pins[0], data.pins[2]],
  });
  expect(catalog.loadedPins()).toBe(loaded);
  // The search and a chosen card's details come from it as well.
  catalog.requestSearch();
  catalog.requestDetail("13");
  expect(catalog.loadedSearch()?.cards).toEqual([
    expect.objectContaining({ id: "13-100-A001", hasPin: false }),
  ]);
  expect(catalog.loadedDetails(loaded, ["13"])).toBe(catalog.loadedCardData());
  expect(urls(fetched)).toEqual(["/data/full.json"]);
});

it("loads once for the screens of a document and asks again after a failure", async () => {
  const { sharedCardData, loadedCardData } = await fresh();
  let fail = true;
  const fetched = vi.fn(async () =>
    fail ? new Response("", { status: 503 }) : answer(full),
  );
  vi.stubGlobal("fetch", fetched);
  await expect(sharedCardData()).rejects.toThrow("503");
  expect(loadedCardData()).toBeUndefined();
  fail = false;
  const [first, second] = await Promise.all([
    sharedCardData(),
    sharedCardData(),
  ]);
  expect(second).toBe(first);
  expect(await sharedCardData()).toBe(first);
  expect(loadedCardData()).toBe(first);
  // The failure asked twice (the kept answer, then the server).
  expect(fetched).toHaveBeenCalledTimes(3);
});

it("asks for failed details again past the kept answer, and tells each change", async () => {
  let fail = true;
  const fetched = vi.fn(async (url: string, _init?: RequestInit) =>
    url.includes("detail-") && fail
      ? new Response("", { status: 503 })
      : answer(fileFor(url)),
  );
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  const loaded = await map.sharedPins();
  const changes = vi.fn();
  map.subscribeData(changes);
  map.requestDetail("13");
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13"])).toBe("failed"),
  );
  fail = false;
  map.requestDetail("13");
  // Asked again: the failure is no longer what there is to show.
  expect(map.loadedDetails(loaded, ["13"])).toBeNull();
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13"])).toMatchObject({ cards: [] }),
  );
  expect(fetched.mock.calls.at(-1)?.[1]).toMatchObject({ cache: "reload" });
  expect(changes).toHaveBeenCalledTimes(3);
});

it("reads a prefecture ahead of a choice at low priority, and hands it to the choice", async () => {
  const fetched = vi.fn(async (url: string, _init?: RequestInit) =>
    answer(fileFor(url)),
  );
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  const loaded = await map.sharedPins();
  map.requestDetail("13", true);
  map.requestDetail("13");
  await vi.waitFor(() =>
    expect(map.loadedDetails(loaded, ["13"])).toBeTruthy(),
  );
  // The choice takes the request on its way, at the priority it went with.
  expect(fetched.mock.calls.slice(1)).toEqual([
    ["/data/detail-13.json", expect.objectContaining({ priority: "low" })],
  ]);
});
