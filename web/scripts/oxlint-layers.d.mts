import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

export type Layer = {
  name: string;
  rank: number;
  paths: string[];
  allow?: string[];
  testSupport?: boolean;
  note: string;
};
export type LayerException = {
  from: string;
  to: string;
  tests?: boolean;
  reason: string;
};

export const layers: Layer[];
export const exceptions: LayerException[];
export function locate(
  path: string,
): { layer: Layer; unit: string; module: string } | null;
export function violation(
  importer: string,
  target: string,
  allowed?: LayerException[],
): string | null;
declare const plugin: {
  meta: { name: string };
  rules: { imports: Rule };
};
export default plugin;
