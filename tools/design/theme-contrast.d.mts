export function readLightTokens(): Record<string, string>;
export function lightContrastTable(tokens?: Record<string, string>): Array<{
  use: string;
  foreground: string;
  background: string;
  opacity: number;
  minimum: number;
  ratio: number;
  passes: boolean;
}>;
