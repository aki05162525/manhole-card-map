import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

declare const plugin: {
  meta: { name: string };
  rules: { "no-constructed": Rule };
};
export default plugin;
