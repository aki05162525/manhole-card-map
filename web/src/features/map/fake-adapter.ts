import { vi } from "vitest";
import type { Pin } from "../../domain/types";
import type { MapFocus } from "./map-levels";
import type { Adapter } from "./types";

/**
 * The drawn map as the pages hold it (`onReady`), with every method a spy that
 * moves nothing. Replace a method to give it a result.
 */
export function fakeAdapter() {
  return {
    focus: vi.fn((_focus: MapFocus) => {}),
    select: vi.fn((_pins: Pin[]) => {}),
    locate: vi.fn((_lat: number, _lng: number) => {}),
    diagnostics: {
      view: vi.fn(() => ({ lat: 35, lng: 139, zoom: 4 })),
      exercise: vi.fn(async () => {}),
      tapPoint: vi.fn((_id?: string): { x: number; y: number } | null => null),
    },
  } satisfies Adapter;
}
