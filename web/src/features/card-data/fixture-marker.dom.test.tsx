import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCardData } from "./use-card-data";
import { useCatalogData } from "./use-catalog-data";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["map", useCardData],
  ["catalog", useCatalogData],
])(
  "%s data requests only the card data, never a fixture marker",
  async (_name, useData) => {
    const fetch = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ cards: [], pins: [] })),
    );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useData());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/data/full.json"]);
    // The build mode decides the warning; Vitest runs outside fixture mode.
    expect(result.current.fixture).toBe(false);
  },
);
