"use client";
import { nationalCameraPadding } from "./area-layout";
import { transformBasemapStyle } from "./basemap-style";
import { Map, MapControls } from "../../components/ui/map";
import type { Adapter } from "./types";
import type { Pin } from "../../domain/types";
import { focusCamera, type MapFocus } from "./map-levels";
import { MapFailureBoundary } from "./map-boundary";
import { MapLayers } from "./map-layers";
export { selectionPadding } from "./map-layout";
export type CardMapProps = {
  focus: MapFocus;
  onFocus(focus: MapFocus): void;
  countPinsSource: Pin[];
  pins: Pin[];
  selectedPins: Pin[];
  onSelect(ids: string[], pinId: string): void;
  onDismiss?(): void;
  onReady(adapter: Adapter): void;
  onError(message: string): void;
  onWarning?(message: string): void;
};
const styleUrl =
  import.meta.env.MODE === "fixture"
    ? "/map-style.json"
    : import.meta.env.VITE_MAP_STYLE_URL;

const transformStyle: import("maplibre-gl").TransformStyleFunction = (
  _previous,
  next,
) => transformBasemapStyle(next);

export default function CardMap(props: CardMapProps) {
  return (
    <MapFailureBoundary {...props}>
      {(callbacks) => (
        <Map
          // Keep one source style; the app repaints it in place for OS changes.
          theme="light"
          locale={{
            "Map.Title": "カードの地図",
            "AttributionControl.ToggleAttribution": "地図の出典を表示",
            "AttributionControl.MapFeedback": "地図の問題を報告",
            "NavigationControl.ZoomIn": "拡大",
            "NavigationControl.ZoomOut": "縮小",
            "NavigationControl.ResetBearing": "北を上に戻す",
          }}
          hideDefaultLoader
          transformStyle={transformStyle}
          styles={styleUrl ? { light: styleUrl, dark: styleUrl } : undefined}
          bounds={focusCamera({ area: null, pref: null }).bounds}
          fitBoundsOptions={{ padding: nationalCameraPadding(64) }}
          onError={(error) => callbacks.onError(String(error))}
          maxZoom={18}
          minZoom={2}
          localIdeographFontFamily="sans-serif"
          attributionControl={{
            compact: false,
          }}
        >
          <MapLayers {...props} {...callbacks} />
          <MapControls position="bottom-right" className="card-map-controls" />
        </Map>
      )}
    </MapFailureBoundary>
  );
}
