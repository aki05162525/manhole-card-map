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
