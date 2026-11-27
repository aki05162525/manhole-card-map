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
export function withFirstPaint(html: string, style: string): string;
export function firstPaint(
  html: string,
  options?: { url?: string; state?: unknown },
): Document;
export function checkFirstPaint(
  html: string,
  options?: { headers?: string },
): { id: string; label: string; x: number; y: number }[];
