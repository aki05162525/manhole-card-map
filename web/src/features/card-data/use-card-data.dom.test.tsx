import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Data } from "../../domain/types";
import { metrics } from "../../shared/browser/explorer-metrics";
import { loadedCardData, loadedPins, sharedMapData } from "./card-data";
import { useCardData } from "./use-card-data";

vi.mock("./card-data", () => ({
  fixtureBuild: false,
  loadedCardData: vi.fn(),
  loadedPins: vi.fn(),
  sharedMapData: vi.fn(),
}));

const pins = [{ id: "p" }] as Data["pins"];
const data = { updated: "same", pins } as Data;
function answer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
/** A load whose answers the test gives. */
function load() {
  const answers = {
    pins: answer<Pick<Data, "updated" | "pins">>(),
    data: answer<Data>(),
  };
  vi.mocked(sharedMapData).mockReturnValue({
    pins: answers.pins.promise,
    data: answers.data.promise,
    askDetails() {},
  });
  return answers;
}
const measured = (name: string) =>
  performance.getEntriesByName(name, "measure").length;

beforeEach(() => {
  window.enableMapDiagnostics = true;
  // As the shared load marks its request (`startLoad`).
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

it("draws the pins as they arrive, then everything, and measures both", async () => {
  const answers = load();
  const { result } = renderHook(() => useCardData());
  expect(result.current).toMatchObject({ pins: null, data: null, error: "" });
  answers.pins.resolve({ updated: "same", pins });
  await waitFor(() => expect(result.current.pins).toBe(pins));
  expect(result.current.data).toBeNull();
  answers.data.resolve(data);
  await waitFor(() => expect(result.current.data).toBe(data));
  // Read by name (`scripts/perf/summarize-map-performance.mjs`).
  expect([measured("pins-load"), measured("data-load")]).toEqual([1, 1]);
});

it("draws at once the pins another screen of the document has received", () => {
  load();
  vi.mocked(loadedPins).mockReturnValue({ updated: "same", pins });
  const { result } = renderHook(() => useCardData());
  expect(result.current).toMatchObject({ pins, data: null });
});

it("draws at once everything another screen has received, and asks for nothing", () => {
  vi.mocked(loadedCardData).mockReturnValue(data);
  const { result } = renderHook(() => useCardData());
  expect(result.current).toMatchObject({ pins, data, error: "" });
  expect(sharedMapData).not.toHaveBeenCalled();
});

it("says that the data could not be read, and counts the failure", async () => {
  const answers = load();
  const { result } = renderHook(() => useCardData());
  answers.pins.reject(new Error("offline"));
  answers.data.reject(new Error("offline"));
  await waitFor(() => expect(result.current.error).not.toBe(""));
  expect(metrics.errors).toEqual(["Error: offline"]);
});

it.each([
  [
    "answers",
    (answers: ReturnType<typeof load>) => {
      answers.pins.resolve({ updated: "same", pins });
      answers.data.resolve(data);
    },
  ],
  [
    "a failure",
    (answers: ReturnType<typeof load>) => {
      answers.pins.reject(new Error("offline"));
      answers.data.reject(new Error("offline"));
    },
  ],
])(
  "measures and counts nothing for %s that come once the map has gone",
  async (_, settle) => {
    const answers = load();
    renderHook(() => useCardData()).unmount();
    settle(answers);
    // Every handler of the answers has run by the next task.
    await new Promise((resolve) => setTimeout(resolve));
    expect([measured("pins-load"), measured("data-load")]).toEqual([0, 0]);
    expect(metrics.errors).toEqual([]);
  },
);
