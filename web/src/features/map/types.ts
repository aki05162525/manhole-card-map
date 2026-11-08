import type { Pin, Status } from "../../domain/types";
import type { MapFocus } from "./map-levels";
type View = { lat: number; lng: number; zoom: number };
export type Adapter = {
  ready: Promise<void>;
  focus(focus: MapFocus): void;
  select(pins: Pin[]): void;
  locate(lat: number, lng: number): void;
  view(): View;
  exercise(): Promise<void>;
  tapPoint(id?: string): { x: number; y: number } | null;
};
export const colors: Record<Status, string> = {
  active: "#2e6f62",
  upcoming: "#3d4f9a",
  suspended: "#8a5a00",
  ended: "#5b6461",
  unknown: "#9c3456",
};
