type Color = string | number[];
export function contrastRatio(foreground: Color, background: Color): number;
export function composite(foreground: Color, background: Color, opacity: number): number[];
