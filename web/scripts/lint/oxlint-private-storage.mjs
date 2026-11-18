// Oxlint JS plugin (`.oxlintrc.json`): the browser's storage and the
// document's `cookie`, in product code of src/, only in the files a row of
// `allowed` names, and there only the names the row gives. Every place a name
// is written counts: a global (`localStorage`), a member (`window.localStorage`,
// `w.sessionStorage` on any object), a key (`const { localStorage } = window`)
// and a string (`window["indexedDB"]`, `Reflect.set(document, "cookie", …)`,
// `Object.getOwnPropertyDescriptor(Document.prototype, "cookie")`). A name
// built at run time (`"local" + "Storage"`, `eval`) is not seen. Tests and test
// helpers are not checked; `layers/imports` keeps product code from importing
// them. The Worker's `caches` (Cloudflare's Cache API) is outside src/.
import { fileURLToPath } from "node:url";
import { relative, sep } from "node:path";
import { isTestHelper, modulePath } from "./oxlint-layers.mjs";

const webRoot = fileURLToPath(new URL("../..", import.meta.url));
const testFile = /\.test\.[cm]?[jt]sx?$/;

export const names = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "cookieStore",
  "cookie",
];

/** `files` (web/-relative, without extension) may use `names`. */
export const allowed = [
  {
    files: ["src/session/invite-token", "src/session/tab-recovery"],
    names: ["sessionStorage"],
    reason:
      "招待トークンと回復の識別子を、それぞれ1つのキーでタブの中だけに置く",
  },
  {
    files: ["src/session/signed-in"],
    names: ["cookie"],
    reason: "Worker の表示用 Cookie を読み、終了で消す",
  },
];

const message = (name) => {
  const files = allowed
    .filter((row) => row.names.includes(name))
    .flatMap((row) => row.files);
  const where = files.length
    ? `${files.join("・")} だけが使う`
    : "製品コードでは使わない";
  return `${name} は${where}。記録・フレンド・アカウントの値をブラウザーに残さない（docs/account-design.md の PF-5。許可は scripts/lint/oxlint-private-storage.mjs）。`;
};

export default {
  meta: { name: "private-storage" },
  rules: {
    names: {
      create(context) {
        const file = relative(webRoot, context.filename).split(sep).join("/");
        if (
          !file.startsWith("src/") ||
          testFile.test(file) ||
          isTestHelper(file)
        )
          return {};
        const self = modulePath(file);
        const own = new Set(
          allowed
            .filter((row) => row.files.includes(self))
            .flatMap((row) => row.names),
        );
        // A shorthand property (`{ localStorage }`) is a key and a value at one place.
        const seen = new Set();
        const check = (node, name) => {
          if (!names.includes(name) || own.has(name) || seen.has(node.start))
            return;
          seen.add(node.start);
          context.report({ node, message: message(name) });
        };
        return {
          Identifier: (node) => check(node, node.name),
          Literal: (node) => check(node, node.value),
          TemplateElement: (node) => check(node, node.value.cooked),
        };
      },
    },
  },
};
