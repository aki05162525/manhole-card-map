import { afterEach, expect, it, vi } from "vitest";
const captured = vi.hoisted(() => ({
  maxZoom: 0,
  install: undefined as undefined | ((map: unknown) => Promise<void>),
}));
vi.mock("./leaflet-common", () => ({
  leafletCreate: (max: number, install: (map: unknown) => Promise<void>) => {
    captured.maxZoom = max;
    captured.install = install;
    return install;
  },
}));
vi.mock("leaflet", () => ({ default: { canvas: () => null } }));
import "./simplified";
const map = { attributionControl: { addAttribution() {} } };
afterEach(() => vi.unstubAllGlobals());
it("rejects failed background HTTP responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(captured.install!(map)).rejects.toThrow("503");
});
it("rejects failed background fetches", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(captured.install!(map)).rejects.toThrow("offline");
});
it("rejects a missing Canvas renderer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [130, 30],
                  [131, 30],
                  [131, 31],
                  [130, 30],
                ],
              ],
            },
          },
        ],
      }),
    }),
  );
  await expect(captured.install!(map)).rejects.toThrow("Canvas");
});
it("rejects an empty background rather than hanging ready", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    }),
  );
  await expect(captured.install!(map)).rejects.toThrow("形式");
});

it("limits navigation to the supported overview scale", () => {
  expect(captured.maxZoom).toBe(8);
});
