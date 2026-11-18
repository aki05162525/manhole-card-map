import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

export type Guarded = {
  module: string;
  names: string[];
  importers: string[];
  reason: string;
};

export const guarded: Guarded[];
declare const plugin: {
  meta: { name: string };
  rules: { imports: Rule };
};
export default plugin;
