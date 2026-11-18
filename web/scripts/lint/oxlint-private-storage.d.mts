import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

export const names: string[];
export const allowed: { files: string[]; names: string[]; reason: string }[];
declare const plugin: {
  meta: { name: string };
  rules: { names: Rule };
};
export default plugin;
