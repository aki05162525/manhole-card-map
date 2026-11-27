import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MapStage } from "./map-stage";

vi.mock("./card-map", () => {
  throw new Error("map chunk unavailable");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("reports the map module's load error to the page", async () => {
  const loadError = await import("./card-map").catch((error: unknown) =>
    String(error),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const onError = vi.fn();
  await act(async () => {
    render(
      <MapStage
        start
        pinsLoaded
        focus={{ area: null, pref: null }}
        countPinsSource={[]}
        pins={[]}
        selectedPins={[]}
        onFocus={vi.fn()}
        onSelect={vi.fn()}
        onReady={vi.fn()}
        onError={onError}
        surround={{
          cover: () => ({ notices: 0, trail: 0, sheet: 0 }),
          watched: () => [],
          watchedForLevel: () => [],
        }}
      />,
    );
  });
  expect(onError).toHaveBeenCalledExactlyOnceWith(loadError);
});
