import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import { afterAll, describe, it } from "vitest";
import plugin from "./oxlint-context-values.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const web = fileURLToPath(new URL("../..", import.meta.url));
const tester = new RuleTester({ languageOptions: { sourceType: "module" } });

// Modules the tests import, for the forms no file of the tree has: outside
// the linted directories, and gone once the tests end.
const cache = join(web, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const dir = mkdtempSync(join(cache, "context-values-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const modules: Record<string, string> = {
  "made.ts": `import { createContext as make } from "react";
const Hidden = /* @__PURE__ */ make(0);
export { Hidden as Shown };
export default make(null);`,
  "namespace.ts": `import * as React from "react";
export const Counter = React.createContext(0);`,
  "again.ts": `export { Shown as Again } from "./made";
export * from "./namespace";`,
  "imported.ts": `import { Counter } from "./namespace";
export { Counter as Imported };`,
  "plain.tsx": `import { createContext } from "react";
export const Panel = ({ value }: { value: object }) => <div>{String(value)}</div>;
export const made = () => createContext(0);
function createContextLike() { return 0; }
export const NotContext = createContextLike();`,
};
for (const [name, source] of Object.entries(modules))
  writeFileSync(join(dir, name), source);
// The fixtures as a src/features/records/ file imports them.
const fixtures = relative(join(web, "src/features/records"), dir);

const file = "src/features/records/probe.tsx";
const valid = (code: string, filename = file) => ({
  filename: web + filename,
  code,
});
const invalid = (code: string, errors = 1) => ({
  filename: web + file,
  code,
  errors: Array.from({ length: errors }, () => ({
    message: /Context の value に描画ごとに作る/,
  })),
});

const records = `import { RecordsContext, inactive } from "./records-context";`;

tester.run("context-values/no-constructed", plugin.rules["no-constructed"], {
  valid: [
    // A value made once, or by useMemo, is handed as it is.
    valid(`${records}
export const A = () => <RecordsContext value={inactive}>x</RecordsContext>;`),
    valid(`${records}
import { useMemo } from "react";
export function A({ n }: { n: string }) {
  const value = useMemo(() => ({ ...inactive, notification: n }), [n]);
  return <RecordsContext value={value}>x</RecordsContext>;
}`),
    // A context of a primitive.
    valid(`import { ScreenActivity } from "../../shared/browser/screen-activity";
export const A = ({ n }: { n: number }) => <ScreenActivity value={n > 0}>x</ScreenActivity>;`),
    // A component, imported or of the same name, is not a context.
    valid(`import { Panel, NotContext } from "${fixtures}/plain";
export const A = () => <><Panel value={{}} /><NotContext value={[]} /></>;`),
    valid(`import { RecordBadge as RecordsContext } from "./record-controls";
export const A = () => <RecordsContext value={{}} ids={[]} />;`),
    valid(`import { RecordsContext } from "./records-context";
export function A() {
  const RecordsContext = (props: { value: object }) => <b>{String(props.value)}</b>;
  return <RecordsContext value={{}} />;
}`),
    // Types only, and other props.
    valid(`import type { Records } from "./records-context";
${records}
export const A = (props: { r: Records }) => <RecordsContext value={props.r} key={String({})}>x</RecordsContext>;`),
    // Tests and test helpers may build the value in place.
    valid(
      `${records}
export const T = () => <RecordsContext value={{ ...inactive }}>x</RecordsContext>;`,
      "src/features/records/probe.dom.test.tsx",
    ),
    valid(
      `${records}
export const T = () => <RecordsContext value={{ ...inactive }}>x</RecordsContext>;`,
      "src/features/records/fake-records.tsx",
    ),
  ],
  invalid: [
    // React 19's form and .Provider, by its name and by an alias.
    invalid(`${records}
export const A = () => <RecordsContext value={{ ...inactive }}>x</RecordsContext>;`),
    invalid(`import { RecordsContext as Own, inactive } from "./records-context";
export const A = ({ n }: { n: string }) => <Own.Provider value={{ ...inactive, notification: n }}>x</Own.Provider>;`),
    // Through a namespace import.
    invalid(
      `import * as records from "./records-context";
export const A = () => <records.RecordsContext value={{ ...records.inactive }}>x</records.RecordsContext>;
export const B = () => <records.RecordsContext.Provider value={{ ...records.inactive }}>x</records.RecordsContext.Provider>;`,
      2,
    ),
    // Arrays, functions, classes and `new`, in either branch.
    invalid(
      `import { ScreenActivity } from "../../shared/browser/screen-activity";
export const A = ({ on }: { on: boolean }) => <>
  <ScreenActivity value={on ? [] : true}>x</ScreenActivity>
  <ScreenActivity value={(() => true) as never}>x</ScreenActivity>
  <ScreenActivity value={on && new Boolean(on) as never}>x</ScreenActivity>
  <ScreenActivity value={class {} as never}>x</ScreenActivity>
</>;`,
      4,
    ),
    // Contexts made under another name, exported again, by default or
    // through \`export *\`, and with React's namespace.
    invalid(
      `import Made, { Shown } from "${fixtures}/made";
import { Again, Counter } from "${fixtures}/again";
import { Imported } from "${fixtures}/imported";
export const A = () => <>
  <Made value={{}}>x</Made>
  <Shown value={[]}>x</Shown>
  <Again value={[]}>x</Again>
  <Counter value={{} as never}>x</Counter>
  <Imported.Provider value={{} as never}>x</Imported.Provider>
</>;`,
      5,
    ),
    // The JSX may come before the import.
    invalid(`export const A = () => <RecordsContext value={{ ...inactive }}>x</RecordsContext>;
${records}`),
  ],
});
