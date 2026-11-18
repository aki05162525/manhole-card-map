"use client";
import { useRef } from "react";
import { transformBasemapStyle } from "./basemap-style";
import { Map, MapControls } from "../../components/ui/map";
import { mapErrorText, type MapOpening } from "./map-runtime";
import type { Adapter } from "./types";
import type { Pin } from "../../domain/types";
import type { MapFocus } from "./map-levels";
import { levelCamera } from "./map-layout";
import { MapBoundary, useMapFailure } from "./map-boundary";
import { MapLayers } from "./map-layers";
export { selectionPadding } from "./map-layout";
export type CardMapProps = {
  /** Until then the map loads its style and draws no pins. */
  pinsLoaded: boolean;
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

// The pages send no referrer (SE-1). The production basemap key allows only
// the site's hosts, so its requests keep the browser's default: the origin.
const transformRequest: import("maplibre-gl").RequestTransformFunction = (
  url,
) => ({ url, referrerPolicy: "strict-origin-when-cross-origin" });

const transformStyle: import("maplibre-gl").TransformStyleFunction = (
  _previous,
  next,
) => transformBasemapStyle(next);

export default function CardMap(props: CardMapProps) {
  const opening = useRef<MapOpening | null>(null);
  // Called once, as the map is created with the latest props: it opens over
  // the level a reload restores, measured as the first ready fit measures it,
  // and fitted to the pins when they have already arrived.
  const createOptions = (container: HTMLElement) => {
    const { bounds, ...fitBoundsOptions } = levelCamera(
      container,
      props.focus,
      props.countPinsSource,
    );
    opening.current = { focus: props.focus, bounds };
    return { bounds, fitBoundsOptions };
  };
  const failure = useMapFailure(props);
  if (failure.failed) return null;
  return (
    <MapBoundary onError={failure.onFatal}>
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
        transformRequest={transformRequest}
        {...(styleUrl ? { styles: { light: styleUrl, dark: styleUrl } } : {})}
        createOptions={createOptions}
        onError={(error) => failure.onError(mapErrorText(error))}
        maxZoom={18}
        minZoom={2}
        localIdeographFontFamily="sans-serif"
        attributionControl={{
          compact: false,
        }}
      >
        {props.pinsLoaded && (
          <MapLayers
            {...props}
            onError={failure.onError}
            onReady={failure.onReady}
            opening={opening}
          />
        )}
        <MapControls position="bottom-right" className="card-map-controls" />
      </Map>
    </MapBoundary>
  );
}
