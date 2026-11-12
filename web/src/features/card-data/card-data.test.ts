import { afterEach, expect, it, vi } from "vitest";
import { loadCardData } from "./card-data";

const fresh = async () => {
  vi.resetModules();
  return import("./card-data");
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reads the build's own data generation, which the browser may keep for good", async () => {
  vi.stubEnv("VITE_DATA_VERSION", "abc123");
  const fetched = vi.fn(
    async (_url: string) =>
      new Response(JSON.stringify({ updated: "same", pins: [], cards: [] })),
  );
  vi.stubGlobal("fetch", fetched);
  await loadCardData("full");
  await loadCardData("split");
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
      ? new Response(JSON.stringify({ updated: "same", pins: [], cards: [] }))
      : new Response("<!doctype html>", { status: 404 }),
  );
  vi.stubGlobal("fetch", fetched);
  await expect(loadCardData("full")).resolves.toMatchObject({
    updated: "same",
  });
  expect(fetched).toHaveBeenCalledTimes(2);
});

it("rejects split files from different generations", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({
            updated: url.includes("pins") ? "old" : "new",
            pins: [],
            cards: [],
          }),
        ),
    ),
  );
  await expect(loadCardData("split")).rejects.toThrow("データの版が一致しない");
});

it("keeps full and matched split data equivalent, including nullable fields", async () => {
  const data = {
    updated: "same",
    pins: [{ id: "place" }],
    cards: [{ hours: null, links: null }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.includes("pins")
              ? { updated: data.updated, pins: data.pins }
              : url.includes("details")
                ? { ...data, pins: null }
                : data,
          ),
        ),
    ),
  );
  expect(await loadCardData("full")).toEqual(data);
  expect(await loadCardData("split")).toEqual(data);
});

it("loads each mode once for the screens of a document and asks again after a failure", async () => {
  const { sharedCardData, loadedCardData } = await fresh();
  let fail = true;
  const fetched = vi.fn(async () =>
    fail
      ? new Response("", { status: 503 })
      : new Response(JSON.stringify({ updated: "same", pins: [], cards: [] })),
  );
  vi.stubGlobal("fetch", fetched);
  await expect(sharedCardData("full")).rejects.toThrow("503");
  expect(loadedCardData("full")).toBeUndefined();
  fail = false;
  const [first, second] = await Promise.all([
    sharedCardData("full"),
    sharedCardData("full"),
  ]);
  expect(second).toBe(first);
  expect(await sharedCardData("full")).toBe(first);
  expect(loadedCardData("full")).toBe(first);
  // The failure asked twice (the kept answer, then the server).
  expect(fetched).toHaveBeenCalledTimes(3);
});
