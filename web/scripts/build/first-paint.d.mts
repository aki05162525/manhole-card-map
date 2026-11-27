export function buildStageScript(mode: string): Promise<string>;
export function criticalCss(html: string, css: string): string;
export function inlineHashes(html: string): {
  script: string[];
  style: string[];
};
export function withCspHashes(
  headers: string,
  hashes: { script: string[]; style: string[] },
): string;
export function headersFor(headers: string, path: string): Map<string, string>;
export function cspFor(headers: string, path: string): string;
export function withFirstPaint(html: string, style: string): string;
export function firstPaint(
  html: string,
  options?: {
    url?: string;
    state?: unknown;
    size?: { width: number; height: number };
    onError?: (error: unknown) => void;
  },
): Document;
export function checkFirstPaint(
  html: string,
  options?: { headers?: string },
): { id: string; label: string; x: number; y: number }[];
