// Oxlint JS plugin (`.oxlintrc.json`): exports that product code takes only
// from the files a row names. Elsewhere, an import of the name (with `as` or
// not), a namespace or default import, `export … from` and `export * from`
// the module, `import()`, `require()` and `import x = require()` of it are all
// reported, the module's path resolved as `layers/imports` does (relative,
// `@/`, `/`, with or without extension). Tests and test helpers may import it;
// `layers/imports` keeps product code from importing them.
//
// The files allowed import the module statically and only call the name:
// `name()` or `namespace.name()`. Any other use of the binding (export in any
// place of the file, `export default`, a value passed on or stored, the
// namespace itself as a value, a computed member) is reported, or the rest of
// the code could take the name through them. They may not `import()` or
// `require()` the module, which leaves nothing to follow.
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

/** Whether `node` is the callee of the call that is its parent. */
const called = (node) =>
  node.parent?.type === "CallExpression" && node.parent.callee === node;

const valueUse = (node) =>
  node.parent?.type === "ExportSpecifier" ? "再 export" : "値としての使用";

/** The member a namespace reference reads, or null when it cannot be told. */
const memberName = (node) => {
  const member = node.parent;
  if (member?.type !== "MemberExpression" || member.object !== node)
    return null;
  if (!member.computed) return member.property.name;
  return specifierOf(member.property);
};

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
            message: `${row.module} の ${row.names.join("・")} は ${row.importers.join("・")} だけが取り込み、呼び出しだけに使う（${how}）。${row.reason}。`,
          });
        // An allowed file may call a guarded name and nothing else.
        const callOnly = (variable, row, namespace) => {
          for (const { identifier } of variable.references) {
            if (!namespace) {
              if (!called(identifier))
                report(identifier, row, valueUse(identifier));
              continue;
            }
            const member = memberName(identifier);
            if (member === null)
              report(identifier, row, `モジュールの${valueUse(identifier)}`);
            else if (row.names.includes(member) && !called(identifier.parent))
              report(identifier.parent, row, "値としての使用");
          }
        };
        const whole = (node, how) => {
          const row = rowOf(node);
          if (row) report(node, row, how);
        };
        return {
          ImportDeclaration(node) {
            const row = rowOf(node.source);
            if (!row) return;
            for (const specifier of node.specifiers) {
              const namespace = specifier.type !== "ImportSpecifier";
              if (!namespace && !row.names.includes(nameOf(specifier.imported)))
                continue;
              if (!allowed(row)) {
                report(
                  specifier,
                  row,
                  namespace ? "モジュールごとの取り込み" : "名前の取り込み",
                );
                continue;
              }
              const [variable] =
                context.sourceCode.getDeclaredVariables(specifier);
              if (variable) callOnly(variable, row, namespace);
            }
          },
          ExportNamedDeclaration(node) {
            const row = node.source && rowOf(node.source);
            if (!row) return;
            for (const specifier of node.specifiers)
              if (row.names.includes(nameOf(specifier.local)))
                report(specifier, row, "再 export");
          },
          ExportAllDeclaration(node) {
            const row = rowOf(node.source);
            if (row) report(node, row, "再 export");
          },
          ImportExpression: (node) => whole(node.source, "動的な取り込み"),
          TSImportEqualsDeclaration(node) {
            if (node.moduleReference.type === "TSExternalModuleReference")
              whole(node.moduleReference.expression, "動的な取り込み");
          },
          CallExpression(node) {
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "require"
            )
              whole(node.arguments[0], "動的な取り込み");
          },
        };
      },
    },
  },
};
