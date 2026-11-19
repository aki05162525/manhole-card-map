import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { metrics } from "../../shared/browser/explorer-metrics";
import { ScreenActivity } from "../../shared/browser/screen-activity";
import { fakeAdapter } from "./fake-adapter";
import { useMapController } from "./use-map-controller";

vi.mock("../../shared/browser/painted", () => ({
  painted: () => Promise.resolve(),
}));

type Ask = Parameters<Geolocation["getCurrentPosition"]>;
/** A browser's location service: each request waits for the test to answer. */
function geolocation() {
  const asked: Ask[] = [];
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (...ask: Ask) => {
        asked.push(ask);
      },
    },
  });
  return {
    asked,
    find(latitude: number, longitude: number) {
      asked.at(-1)![0]({
        coords: { latitude, longitude },
      } as GeolocationPosition);
    },
    fail(code: number) {
      asked.at(-1)![1]!({
        code,
        PERMISSION_DENIED: 1,
      } as GeolocationPositionError);
    },
  };
}
const UNAVAILABLE = 2;
const DENIED = 1;

beforeEach(() => {
  window.enableMapDiagnostics = true;
  metrics.ready = 0;
  metrics.errors.length = 0;
  // The map marks its creation before it can be ready.
  performance.mark("map-create");
});
afterEach(() => {
  cleanup();
  delete window.enableMapDiagnostics;
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "geolocation");
  performance.clearMarks();
  performance.clearMeasures();
});

it("moves the map to the position the browser found, and is busy only meanwhile", () => {
  const service = geolocation();
  const adapter = fakeAdapter();
  const { result } = renderHook(() => useMapController());
  expect(result.current.locating).toBe(false);
  act(() => result.current.mapReady(adapter));
  act(() => result.current.locate());
  expect(result.current.locating).toBe(true);
  // A request without a time limit could keep the button busy for ever.
  expect(service.asked[0][2]?.timeout).toBeGreaterThan(0);
  act(() => service.find(35.6, 139.7));
  expect(adapter.locate).toHaveBeenCalledExactlyOnceWith(35.6, 139.7);
  expect(result.current.locating).toBe(false);
  expect(result.current.message).toBe("");
});

it("leaves the map where it is when the position arrives behind another screen", () => {
  const service = geolocation();
  const adapter = fakeAdapter();
  let active = true;
  const { result, rerender } = renderHook(() => useMapController(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(ScreenActivity, { value: active }, children),
  });
  act(() => result.current.mapReady(adapter));
  act(() => result.current.locate());
  active = false;
  rerender();
  act(() => service.find(35.6, 139.7));
  expect(adapter.locate).not.toHaveBeenCalled();
  expect(result.current.locating).toBe(false);
});

it("says so on a device without a location service, without asking", () => {
  const { result } = renderHook(() => useMapController());
  act(() => result.current.locate());
  expect(result.current.message).toBe(
    "この端末では現在地を取得できません。一覧から探してください。",
  );
  expect(result.current.locating).toBe(false);
  // Nothing was refused: no hint about allowing location.
  expect(result.current.locationDenied).toBe(false);
});

it("keeps a new failure's notice for its own five seconds after an earlier one", () => {
  vi.useFakeTimers();
  const service = geolocation();
  const { result } = renderHook(() => useMapController());
  const failed = "現在地を取得できませんでした。もう一度お試しください。";
  act(() => result.current.locate());
  act(() => service.fail(UNAVAILABLE));
  expect(result.current.message).toBe(failed);
  expect(result.current.locating).toBe(false);
  act(() => {
    vi.advanceTimersByTime(3000);
  });
  // Asking again takes the old notice away at once.
  act(() => result.current.locate());
  expect(result.current.message).toBe("");
  act(() => service.fail(UNAVAILABLE));
  act(() => {
    vi.advanceTimersByTime(4000);
  });
  expect(result.current.message).toBe(failed);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.message).toBe("");
});

it("leaves no timer behind when its screen goes away", () => {
  vi.useFakeTimers();
  const service = geolocation();
  const { result, unmount } = renderHook(() => useMapController());
  act(() => result.current.locate());
  act(() => service.fail(UNAVAILABLE));
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("explains a refusal until it is closed, and a background warning replaces it", () => {
  vi.useFakeTimers();
  const service = geolocation();
  const { result } = renderHook(() => useMapController());
  act(() => result.current.locate());
  act(() => service.fail(DENIED));
  expect(result.current.locationDenied).toBe(true);
  expect(result.current.message).toBe("位置情報の利用が許可されていません。");
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
  expect(result.current.locationDenied).toBe(true);
  act(() => result.current.mapWarning());
  expect(result.current.locationDenied).toBe(false);
  expect(result.current.message).toBe(
    "背景の一部を読み込めませんでした。地図の移動とカードの選択は引き続き使えます。",
  );
  act(() => result.current.dismissMessage());
  expect(result.current.message).toBe("");
});

it("follows the map from loading to ready or failed, and records the failure", () => {
  const { result } = renderHook(() => useMapController());
  expect(result.current.mapState).toBe("loading");
  act(() => result.current.mapError("Error: style failed"));
  expect(result.current.mapState).toBe("failed");
  expect(metrics.errors).toEqual(["Error: style failed"]);
});

// scripts/perf and scripts/browser read these from the page.
it("gives the measurement scripts the drawn map and its startup times", async () => {
  const adapter = fakeAdapter();
  const { result, unmount } = renderHook(() => useMapController());
  const diagnostics = () =>
    (
      window as unknown as {
        mapDiagnostics: { adapter?: unknown; metrics: unknown };
      }
    ).mapDiagnostics;
  expect(diagnostics().metrics).toBe(metrics);
  expect(diagnostics().adapter).toBeUndefined();
  await act(async () => result.current.mapReady(adapter));
  expect(result.current.mapState).toBe("ready");
  expect(diagnostics().adapter).toBe(adapter.diagnostics);
  expect(metrics.ready).toBeGreaterThan(0);
  expect(performance.getEntriesByName("map-render")).toHaveLength(1);
  const [startup] = performance.getEntriesByName("startup");
  expect(startup.startTime).toBe(0);
  expect(startup.duration).toBe(
    performance.getEntriesByName("map-ready")[0].startTime,
  );
  unmount();
  expect(diagnostics()).toBeUndefined();
});

it("keeps the map usable without publishing diagnostics on ordinary startup", async () => {
  delete window.enableMapDiagnostics;
  const { result } = renderHook(() => useMapController());
  await act(async () => result.current.mapReady(fakeAdapter()));
  expect(result.current.mapState).toBe("ready");
  expect(Object.hasOwn(window, "mapDiagnostics")).toBe(false);
  expect(Object.hasOwn(window, "prototype")).toBe(false);
  expect(performance.getEntriesByName("startup")).toHaveLength(0);
  act(() => result.current.mapError("style failed"));
  expect(result.current.mapState).toBe("failed");
  expect(metrics.errors).toEqual([]);
});
