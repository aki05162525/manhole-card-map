import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PinsFile } from "../../domain/public-views";
import { metrics } from "../../shared/browser/explorer-metrics";
import { loadedPins, sharedPins } from "./card-data";
import { useCardData } from "./use-card-data";

vi.mock(import("./card-data"), async (original) => ({
  ...(await original()),
  loadedPins: vi.fn(),
  sharedPins: vi.fn(),
}));

const pins = { updated: "same", pins: [{ id: "p" }] } as PinsFile;
/** A load whose answer the test gives. */
function load() {
  let resolve!: (value: PinsFile) => void;
  let reject!: (error: Error) => void;
  vi.mocked(sharedPins).mockReturnValue(
    new Promise<PinsFile>((yes, no) => {
      resolve = yes;
      reject = no;
    }),
  );
  return { resolve, reject };
}
const measured = (name: string) =>
  performance.getEntriesByName(name, "measure").length;

beforeEach(() => {
  window.enableMapDiagnostics = true;
  // As the shared load marks its request (`load`).
  performance.mark("data-requested");
});
afterEach(() => {
  cleanup();
  delete window.enableMapDiagnostics;
  vi.resetAllMocks();
  performance.clearMarks();
  performance.clearMeasures();
  metrics.errors.length = 0;
});

it("draws the pins as they arrive, and measures their load", async () => {
  const answer = load();
  const { result } = renderHook(() => useCardData(true));
  expect(result.current).toMatchObject({ pins: null, error: "" });
  answer.resolve(pins);
  await waitFor(() => expect(result.current.pins).toBe(pins));
  // Read by name (`scripts/perf/summarize-map-performance.mjs`).
  expect(measured("pins-load")).toBe(1);
});

it("asks for no pin before the map engine is read", () => {
  const { result, rerender } = renderHook(({ wanted }) => useCardData(wanted), {
    initialProps: { wanted: false },
  });
  expect(result.current.pins).toBeNull();
  expect(sharedPins).not.toHaveBeenCalled();
  load();
  rerender({ wanted: true });
  expect(sharedPins).toHaveBeenCalledOnce();
});

it("draws at once the pins another screen of the document has received, and asks for nothing", () => {
  vi.mocked(loadedPins).mockReturnValue(pins);
  const { result } = renderHook(() => useCardData(true));
  expect(result.current).toMatchObject({ pins, error: "" });
  expect(sharedPins).not.toHaveBeenCalled();
});

it("says that the data could not be read, and counts the failure", async () => {
  const answer = load();
  const { result } = renderHook(() => useCardData(true));
  answer.reject(new Error("offline"));
  await waitFor(() => expect(result.current.error).not.toBe(""));
  expect(metrics.errors).toEqual(["Error: offline"]);
});

it.each([
  ["an answer", (answer: ReturnType<typeof load>) => answer.resolve(pins)],
  [
    "a failure",
    (answer: ReturnType<typeof load>) => answer.reject(new Error("offline")),
  ],
])(
  "measures and counts nothing for %s that comes once the map has gone",
  async (_, settle) => {
    const answer = load();
    renderHook(() => useCardData(true)).unmount();
    settle(answer);
    // Every handler of the answer has run by the next task.
    await new Promise((resolve) => setTimeout(resolve));
    expect(measured("pins-load")).toBe(0);
    expect(metrics.errors).toEqual([]);
  },
);
