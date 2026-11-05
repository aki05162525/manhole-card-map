import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { type Create, colors, painted } from "./types";
import { boundedZoom, clusterCardIds, initialBackground } from "./map-behavior";
export function leafletCreate(
  maxZoom: number,
  background: (map: L.Map) => Promise<void>,
): Create {
  return (pins, onSelect, view) => {
    const map = L.map("map", {
      zoomControl: true,
      fadeAnimation: false,
      zoomAnimation: true,
      maxZoom,
    });
    const japan = () =>
      map.fitBounds(
        [
          [20, 122],
          [46, 154],
        ],
        { animate: false, padding: [8, 8] },
      );
    if (view)
      map.setView([view.lat, view.lng], boundedZoom(view.zoom, maxZoom));
    else japan();
    const clusters = L.markerClusterGroup({
      maxClusterRadius: 45,
      animate: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (c) =>
        L.divIcon({
          className: "cluster",
          html: String(c.getChildCount()),
          iconSize: [34, 34],
        }),
    });
    const cards = new Map<L.Marker, string[]>();
    clusters.on("clusterclick", (event: L.LeafletEvent) => {
      const cluster = (event as L.LeafletEvent & { layer: L.MarkerCluster })
        .layer;
      if (map.getZoom() >= maxZoom)
        onSelect(clusterCardIds(cluster.getAllChildMarkers(), cards));
      else cluster.zoomToBounds();
    });
    const markers = new Map<string, L.Marker>();
    const icon = (p: (typeof pins)[number], selected = false) =>
      L.divIcon({
        className: `pin ${p.kind} ${p.status}${selected ? " selected" : ""}`,
        html: `<span style="background:${colors[p.status]};position:absolute;inset:0;border-radius:inherit;z-index:-1"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], {
        icon: icon(p),
        title: `${p.kind === "lid" ? "蓋" : "配布場所"} ${p.cardIds.join(",")}`,
      }).on("click", () => onSelect(p.cardIds));
      markers.set(p.id, marker);
      cards.set(marker, p.cardIds);
      clusters.addLayer(marker);
    }
    clusters.addTo(map);
    const ready = initialBackground(() => background(map), painted);
    const selected = L.layerGroup().addTo(map);
    let current: L.CircleMarker | undefined;
    return {
      ready,
      japan,
      view: () => ({
        lat: map.getCenter().lat,
        lng: map.getCenter().lng,
        zoom: map.getZoom(),
      }),
      onMove: (fn) => {
        map.on("moveend", fn);
      },
      select(ps) {
        map.invalidateSize({ pan: false });
        selected.clearLayers();
        for (const p of ps)
          L.marker([p.lat, p.lng], { icon: icon(p, true) })
            .on("click", () => onSelect(p.cardIds))
            .addTo(selected);
        if (ps.length)
          map.fitBounds(L.latLngBounds(ps.map((p) => [p.lat, p.lng])), {
            maxZoom: boundedZoom(15, maxZoom),
            padding: [55, 35],
            animate: false,
          });
      },
      locate(lat, lng) {
        current?.remove();
        current = L.circleMarker([lat, lng], {
          radius: 9,
          color: "white",
          fillColor: "#2678df",
          fillOpacity: 1,
        }).addTo(map);
        map.setView([lat, lng], boundedZoom(14, maxZoom));
      },
      async exercise() {
        map.setView([35.68, 139.76], 10, { animate: false });
        await new Promise((r) => setTimeout(r, 1500));
        for (let i = 0; i < 6; i++) {
          map.panBy([i % 2 ? 80 : -80, 30], { animate: true, duration: 0.3 });
          await new Promise((r) => setTimeout(r, 400));
          map.setZoom(boundedZoom(i % 2 ? 10 : 11, maxZoom), { animate: true });
          await new Promise((r) => setTimeout(r, 400));
        }
      },
      tapPoint() {
        for (const m of markers.values()) {
          if (map.hasLayer(m)) {
            const p = map.latLngToContainerPoint(m.getLatLng());
            if (
              p.x > 20 &&
              p.x < map.getSize().x - 20 &&
              p.y > 20 &&
              p.y < map.getSize().y - 20
            )
              return { x: p.x, y: p.y };
          }
        }
        return null;
      },
    };
  };
}
