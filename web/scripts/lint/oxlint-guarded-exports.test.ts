import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, expect, it, test } from "vitest";
import plugin, { guarded } from "./oxlint-guarded-exports.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const web = fileURLToPath(new URL("../..", import.meta.url));
const tester = new RuleTester({ languageOptions: { sourceType: "module" } });
const valid = (filename: string, code: string) => ({
  filename: web + filename,
  code,
});
const invalid = (filename: string, code: string, how: string) => ({
  filename: web + filename,
  code,
  errors: [{ message: new RegExp(`forgetSignedIn は .*（${how}）`) }],
});
const page = "src/pages/account/account-page.tsx";
const guard = "src/session/session-guard.ts";

tester.run("guarded/imports", plugin.rules.imports, {
  valid: [
    // The guard itself, by any path.
    valid(guard, `import { forgetSignedIn } from "./signed-in";`),
    valid(
      guard,
      `import { forgetSignedIn as f } from "@/session/signed-in.ts";`,
    ),
    // The module's other exports, for anyone.
    valid(
      page,
      `import { sessionChanged, signedIn } from "../../session/signed-in";`,
    ),
    valid(page, `export { signedIn } from "../../session/signed-in";`),
    // Tests and test helpers reset the session with it.
    valid(
      "src/pages/account/account-page.dom.test.tsx",
      `import { forgetSignedIn } from "../../session/signed-in";`,
    ),
    valid(
      "src/session/fake-session.ts",
      `import * as session from "./signed-in";`,
    ),
    // Another module's export of the same name.
    valid(page, `import { forgetSignedIn } from "./signed-in";`),
  ],
  invalid: [
    invalid(
      page,
      `import { forgetSignedIn } from "../../session/signed-in";`,
      "名前の取り込み",
    ),
    invalid(
      "src/features/records/records-provider.tsx",
      `import { signedIn, forgetSignedIn as end } from "@/session/signed-in";`,
      "名前の取り込み",
    ),
    invalid(
      "src/features/friends/friend-map.tsx",
      `import { forgetSignedIn } from "/src/session/signed-in.ts";`,
      "名前の取り込み",
    ),
    invalid(
      "src/session/private-reads.ts",
      `import { forgetSignedIn } from "../session/./signed-in";`,
      "名前の取り込み",
    ),
    invalid(
      page,
      `import * as session from "../../session/signed-in";`,
      "モジュールごとの取り込み",
    ),
    invalid(
      page,
      `const session = await import("../../session/signed-in");`,
      "モジュールごとの取り込み",
    ),
    invalid(
      page,
      "const session = import(`@/session/signed-in`);",
      "モジュールごとの取り込み",
    ),
    invalid(
      page,
      `const session = require("../../session/signed-in");`,
      "モジュールごとの取り込み",
    ),
    invalid(
      page,
      `export { forgetSignedIn } from "../../session/signed-in";`,
      "再 export",
    ),
    invalid(page, `export * from "../../session/signed-in";`, "再 export"),
    // The guard may not hand it on either.
    invalid(
      guard,
      `import { forgetSignedIn as end } from "./signed-in"; export { end };`,
      "再 export",
    ),
    invalid(
      guard,
      `export { forgetSignedIn as end } from "./signed-in";`,
      "再 export",
    ),
  ],
});

test.each(guarded)(
  "$module exports $names, kept for files that exist",
  ({ module, names, importers }) => {
    const source = readFileSync(`${web}${module}.ts`, "utf8");
    for (const name of names)
      expect(source).toMatch(
        new RegExp(`export (?:const|function|let) ${name}\\b`),
      );
    for (const importer of importers)
      expect(existsSync(`${web}${importer}.ts`)).toBe(true);
  },
);
