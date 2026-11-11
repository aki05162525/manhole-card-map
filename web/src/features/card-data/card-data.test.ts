import { afterEach, expect, it, vi } from "vitest";
import { loadCardData } from "./card-data";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("asks for the build's data version, which the browser may keep for good", async () => {
  vi.stubEnv("VITE_DATA_VERSION", "abc123");
  const fetched = vi.fn(
    async (_url: string) =>
      new Response(JSON.stringify({ updated: "same", pins: [], cards: [] })),
  );
  vi.stubGlobal("fetch", fetched);
  await loadCardData("full");
  await loadCardData("split");
  expect(fetched.mock.calls.map(([url]) => url)).toEqual([
    "/data/full.json?v=abc123",
    "/data/pins.json?v=abc123",
    "/data/details.json?v=abc123",
  ]);
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
