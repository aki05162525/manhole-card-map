// Oxlint JS plugin (`.oxlintrc.json`): exports that product code takes only
// from the files a row names. An import of the name (with `as` or not), a
// namespace or default import, `export … from` and `export * from` the
// module, `import()`, `require()` and `import x = require()` of it are all
// reported, the module's path resolved as `layers/imports` does (relative,
// `@/`, `/`, with or without extension). Tests and test helpers may import
// it. The files allowed may not pass the name on (`export { name }`,
// `export … from`), or the rest of the code could take it through them.
import { fileURLToPath } from "node:url";
import { relative, sep } from "node:path";
import {
  isTestHelper,
  modulePath,
  resolveImport,
  specifierOf,
} from "./oxlint-layers.mjs";

const webRoot = fileURLToPath(new URL("../..", import.meta.url));
const testFile = /\.test\.[cm]?[jt]sx?$/;

/**
 * `module` (web/-relative, without extension) keeps `names` for `importers`
 * (files, without extension) alone.
 */
export const guarded = [
  {
    module: "src/session/signed-in",
    names: ["forgetSignedIn"],
    importers: ["src/session/session-guard"],
    reason:
      "表示用 Cookie の消去と各画面への通知は、guard が受理と同じ同期の処理で行う（docs/account-design.md の PF-5 (C)）",
  },
];

const nameOf = (node) => (node.type === "Identifier" ? node.name : node.value);

export default {
  meta: { name: "guarded" },
  rules: {
    imports: {
      create(context) {
        const importer = relative(webRoot, context.filename)
          .split(sep)
          .join("/");
        if (
          importer.startsWith("../") ||
          !/^(?:src|worker)\//.test(importer) ||
          testFile.test(importer) ||
          isTestHelper(importer)
        )
          return {};
        const self = modulePath(importer);
        const rowOf = (source) => {
          const specifier = specifierOf(source);
          if (specifier === null) return null;
          const { path } = resolveImport(importer, specifier);
          if (path === null) return null;
          const target = modulePath(path);
          return guarded.find((row) => row.module === target) ?? null;
        };
        const allowed = (row) => row.importers.includes(self);
        const report = (node, row, how) =>
          context.report({
            node,
            message: `${row.module} の ${row.names.join("・")} は ${row.importers.join("・")} だけが取り込む（${how}）。${row.reason}。`,
          });
        // Local names bound to a guarded export in a file allowed to import it.
        const bound = new Map();
        const whole = (node) => {
          const row = rowOf(node);
          if (row && !allowed(row))
            report(node, row, "モジュールごとの取り込み");
        };
        return {
          ImportDeclaration(node) {
            const row = rowOf(node.source);
            if (!row) return;
            for (const specifier of node.specifiers) {
              if (specifier.type === "ImportSpecifier") {
                const name = nameOf(specifier.imported);
                if (!row.names.includes(name)) continue;
                if (allowed(row)) bound.set(specifier.local.name, row);
                else report(specifier, row, "名前の取り込み");
              } else if (!allowed(row))
                report(specifier, row, "モジュールごとの取り込み");
            }
          },
          ExportNamedDeclaration(node) {
            if (node.source) {
              const row = rowOf(node.source);
              if (!row) return;
              for (const specifier of node.specifiers)
                if (row.names.includes(nameOf(specifier.local)))
                  report(specifier, row, "再 export");
              return;
            }
            for (const specifier of node.specifiers) {
              const row = bound.get(nameOf(specifier.local));
              if (row) report(specifier, row, "再 export");
            }
          },
          ExportAllDeclaration(node) {
            const row = rowOf(node.source);
            if (row) report(node, row, "再 export");
          },
          ImportExpression: (node) => whole(node.source),
          TSImportEqualsDeclaration(node) {
            if (node.moduleReference.type === "TSExternalModuleReference")
              whole(node.moduleReference.expression);
          },
          CallExpression(node) {
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "require"
            )
              whole(node.arguments[0]);
          },
        };
      },
    },
  },
};
