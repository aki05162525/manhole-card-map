import { colors } from "./types";

// WebGL cannot resolve CSS custom properties. Mirror tokens and test the pairs.
const light = {
  land: "#efede8",
  water: "#cdd6d5",
  building: "#e0dcd2",
  green: "#e6e8df",
  road: "#ffffff",
  roadEdge: "#d6d1c6",
  label: "#595c58",
  paper: "#f3f1ec",
  ink: "#1d2321",
  iron: "#1d2321",
  onIron: "#ffffff",
  boundary: "#7b756a",
  selection: "#1d2321",
  inner: "rgba(255,255,255,0.5)",
  reference: "#5f625e",
  pinRim: "#ffffff",
  inactivePinOpacity: 0.35,
  pins: colors,
};
const dark: typeof light = {
  land: "#202723",
  water: "#08151b",
  building: "#29322c",
  green: "#26362d",
  road: "#303a34",
  roadEdge: "#303a34",
  label: "#e8e6df",
  paper: "#141816",
  ink: "#e8e6df",
  iron: "#e8e6df",
  onIron: "#141816",
  boundary: "#9ca99e",
  // Mid-tone iron separates the white outer rim from the dark map.
  selection: "#83988a",
  inner: "rgba(20,24,22,0.5)",
  reference: "#83988a",
  pinRim: "#141816",
  inactivePinOpacity: 0.9,
  pins: {
    active: "#609b85",
    upcoming: "#7990ca",
    suspended: "#b58c47",
    ended: "#83988a",
    unknown: "#bb7c96",
  },
};
export function mapPalette(isDark: boolean) {
  return isDark ? dark : light;
}
export function systemDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}
export function watchMapTheme(
  paint: (dark: boolean) => void,
  media = window.matchMedia("(prefers-color-scheme: dark)"),
) {
  const change = () => paint(media.matches);
  media.addEventListener("change", change);
  change();
  return () => media.removeEventListener("change", change);
}
