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
  active: "#087f8c",
  upcoming: "#4e58bb",
  suspended: "#777777",
  ended: "#777777",
  unknown: "#b12f62",
};
