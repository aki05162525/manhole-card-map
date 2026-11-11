export function readThemeTokens(theme: "light" | "dark"): Record<string, string>;
export function themeContrastTable(tokens: Record<string, string>): Array<{
  category: string;
  use: string;
  foreground: string;
  background: string;
  opacity: number;
  minimum: number;
  ratio: number;
  passes: boolean;
}>;

type MapPalette = {
  land: string;
  water: string;
  building: string;
  green: string;
  road: string;
  roadEdge: string;
  label: string;
  selection: string;
  pinRim: string;
  pins: Record<string, string>;
  inactivePinOpacity: number;
};
export function readMapPalette(theme: "light" | "dark"): MapPalette;
export function mapContrastTable(
  palette: MapPalette,
  dark: boolean,
): ReturnType<typeof themeContrastTable>;
