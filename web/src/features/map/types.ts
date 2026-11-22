import type { Pin, Status } from "../../domain/types";
import type { MapFocus } from "./map-levels";
import type { mapDiagnostics } from "./map-diagnostics";
export type Adapter = {
  focus(focus: MapFocus): void;
  select(pins: Pin[]): void;
  locate(lat: number, lng: number): void;
  diagnostics: ReturnType<typeof mapDiagnostics> | undefined;
};
export const colors: Record<Status, string> = {
  active: "#2e6f62",
  upcoming: "#3d4f9a",
  suspended: "#8a5a00",
  ended: "#5b6461",
  unknown: "#9c3456",
};
