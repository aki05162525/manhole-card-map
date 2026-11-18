import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, expect, it, test } from "vitest";
import plugin, { allowed } from "./oxlint-private-storage.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const web = fileURLToPath(new URL("../..", import.meta.url));
const tester = new RuleTester({ languageOptions: { sourceType: "module" } });
const valid = (filename: string, code: string) => ({
  filename: web + filename,
  code,
});
const invalid = (filename: string, code: string, ...names: string[]) => ({
  filename: web + filename,
  code,
  errors: names.map((name) => ({ message: new RegExp(`^${name} は`) })),
});
const page = "src/pages/account/account-page.tsx";
const invite = "src/session/invite-token.ts";
const signedIn = "src/session/signed-in.ts";

tester.run("private-storage/names", plugin.rules.names, {
  valid: [
    valid(invite, `sessionStorage.setItem("friend-invite", token);`),
    valid(
      "src/session/tab-recovery.ts",
      `window.sessionStorage.getItem("account-recovering");`,
    ),
    valid(signedIn, `document.cookie = "signed_in=; Max-Age=0";`),
    // Tests, test helpers and the Worker are not product code of src/.
    valid("src/app/app.dom.test.tsx", `localStorage.clear();`),
    valid("src/session/fake-session.ts", `document.cookie = "a=b";`),
    valid("worker/card-images.ts", `await caches.default.match(request);`),
    // Words that only contain a name.
    valid(page, `const cookies = "cookie を使う"; cookieLabel();`),
  ],
  invalid: [
    invalid(page, `localStorage.setItem("k", v);`, "localStorage"),
    invalid(page, `window.sessionStorage.setItem("k", v);`, "sessionStorage"),
    invalid(page, `globalThis.indexedDB.open("db");`, "indexedDB"),
    invalid(page, `self.caches.open("c");`, "caches"),
    // Taken out of the global object, or off another name for it.
    invalid(
      page,
      `const { localStorage: l } = window; l.setItem("k", v);`,
      "localStorage",
    ),
    invalid(page, `const { sessionStorage } = globalThis;`, "sessionStorage"),
    invalid(
      page,
      `const w = self; w.sessionStorage.clear();`,
      "sessionStorage",
    ),
    invalid(page, `window["localStorage"].clear();`, "localStorage"),
    invalid(page, `Reflect.get(window, "indexedDB");`, "indexedDB"),
    // Cookies, however they are written.
    invalid(page, `document.cookie = "a=b";`, "cookie"),
    invalid(page, `Reflect.set(document, "cookie", "a=b");`, "cookie"),
    invalid(
      page,
      "Object.getOwnPropertyDescriptor(Document.prototype, `cookie`)?.set?.call(document, `a=b`);",
      "cookie",
    ),
    invalid(page, `void cookieStore.set("a", "b");`, "cookieStore"),
    // A file allowed one name has no other.
    invalid(
      invite,
      `localStorage.setItem("any", v); void window.cookieStore.set("a", "b");`,
      "localStorage",
      "cookieStore",
    ),
    invalid(
      "src/session/tab-recovery.ts",
      `document.cookie = "a=b";`,
      "cookie",
    ),
    invalid(signedIn, `sessionStorage.setItem("k", v);`, "sessionStorage"),
  ],
});

test.each(allowed)("$files are files that exist", ({ files }) => {
  for (const file of files) expect(existsSync(`${web}${file}.ts`)).toBe(true);
});
