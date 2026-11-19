import { afterEach, expect, it, vi } from "vitest";

// Each test is a new document: the module keeps the document's one load.
const fresh = async () => {
  vi.resetModules();
  return import("./card-data");
};
const answer = (body: unknown) => new Response(JSON.stringify(body));

const full = {
  schema: 1,
  updated: "same",
  pins: [],
  cards: [],
  places: [],
  relations: [],
};
const fileFor = (url: string) =>
  url.endsWith("details.json") ? { ...full, pins: null } : full;

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

it.each(["pins", "details"])(
  "rejects an unsupported %s schema before sharing it",
  async (name) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        answer({
          ...fileFor(url),
          schema: url.endsWith(name + ".json") ? 2 : 1,
        }),
      ),
    );
    const map = await fresh();
    const entry = map.sharedMapData();
    map.requestDetails();
    await expect(entry.data).rejects.toThrow();
    expect(map.loadedPins()).toBeUndefined();
  },
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reads the build's own data generation, which the browser may keep for good", async () => {
  vi.stubEnv("VITE_DATA_VERSION", "abc123");
  const fetched = vi.fn(async (url: string) => answer(fileFor(url)));
  vi.stubGlobal("fetch", fetched);
  await (await fresh()).sharedCardData();
  const map = await fresh();
  const load = map.sharedMapData();
  await load.pins;
  map.requestDetails();
  await load.data;
  expect(fetched.mock.calls.map(([url]) => url)).toEqual([
    "/data-v/abc123/full.json",
    "/data-v/abc123/pins.json",
    "/data-v/abc123/details.json",
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

it("gives the map its pins and asks for the details only when told", async () => {
  let details!: (response: Response) => void;
  const fetched = vi.fn((url: string) =>
    url.includes("details")
      ? new Promise<Response>((resolve) => (details = resolve))
      : Promise.resolve(answer({ ...full, pins: [{ id: "p" }] })),
  );
  vi.stubGlobal("fetch", fetched);
  const { sharedMapData, requestDetails, loadedPins, loadedCardData } =
    await fresh();
  const load = sharedMapData();
  expect((await load.pins).pins).toEqual([{ id: "p" }]);
  expect(loadedPins()?.pins).toEqual([{ id: "p" }]);
  expect(loadedCardData()).toBeUndefined();
  expect(fetched.mock.calls.map(([url]) => url)).toEqual(["/data/pins.json"]);
  requestDetails();
  requestDetails();
  await vi.waitFor(() => expect(details).toBeDefined());
  expect(fetched).toHaveBeenCalledTimes(2);
  details(answer({ ...full, pins: null }));
  expect(await load.data).toEqual({
    ...full,
    updated: "same",
    pins: [{ id: "p" }],
    cards: [],
  });
});

it("rejects split files from different generations", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      answer({
        ...fileFor(url),
        updated: url.includes("pins") ? "old" : "new",
      }),
    ),
  );
  const { sharedMapData, requestDetails, loadedCardData } = await fresh();
  const load = sharedMapData();
  requestDetails();
  await expect(load.data).rejects.toThrow("データの版が一致しない");
  expect(loadedCardData()).toBeUndefined();
});

it("keeps full and matched split data equivalent, including nullable fields", async () => {
  const data = {
    ...full,
    updated: "same",
    pins: [{ id: "place" }],
    cards: [{ hours: null, links: null }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      answer(
        url.includes("pins")
          ? { schema: data.schema, updated: data.updated, pins: data.pins }
          : url.includes("details")
            ? { ...data, pins: null }
            : data,
      ),
    ),
  );
  expect(await (await fresh()).sharedCardData()).toEqual(data);
  const map = await fresh();
  const load = map.sharedMapData();
  map.requestDetails();
  expect(await load.data).toEqual(data);
});

it("hands the split load to the catalog and the full load to the map, without a second fetch", async () => {
  const fetched = vi.fn(async (url: string) => answer(fileFor(url)));
  vi.stubGlobal("fetch", fetched);
  const map = await fresh();
  const load = map.sharedMapData();
  await load.pins;
  // The catalog asks for the details itself.
  const split = await map.sharedCardData();
  expect(await load.data).toBe(split);
  expect(fetched).toHaveBeenCalledTimes(2);

  fetched.mockClear();
  const catalog = await fresh();
  const full = await catalog.sharedCardData();
  const kept = catalog.sharedMapData();
  expect(await kept.data).toBe(full);
  expect((await kept.pins).pins).toBe(full.pins);
  expect(fetched.mock.calls.map(([url]) => url)).toEqual(["/data/full.json"]);
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
