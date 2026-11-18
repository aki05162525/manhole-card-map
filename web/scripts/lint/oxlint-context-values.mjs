// Oxlint JS plugin (`.oxlintrc.json`): product code hands a context's
// provider a value made once, not an object, array, function, class or `new`
// built in the JSX on each render. `react/jsx-no-constructed-context-values`
// sees the contexts made in the file itself, but misses one imported from
// another module and written as React 19's `<X value>` (or `<ns.X value>`);
// this rule takes the imported ones, `<X value>` and `<X.Provider value>`,
// following the import (aliases, namespaces, re-exports) to the module that
// made it with `createContext`. A component of the same name is not a
// context. Tests and test helpers may build the value in place.
//
// A value copied in a variable or a helper is beyond a lint rule: the
// records' and the friend map's tests hold the reference a consumer is handed
// across a parent's render.
import { existsSync, readFileSync } from "node:fs";
import { posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";
import { isProductCode, resolveImport } from "./oxlint-layers.mjs";

const webRoot = fileURLToPath(new URL("../..", import.meta.url));
const scriptExtensions = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const message =
  "Context の value に描画ごとに作るオブジェクト・配列・関数・new を渡さない。useMemo・useCallback か、描画の外で作った値を渡す。";

const toWeb = (filename) => relative(webRoot, filename).split(sep).join("/");

/** The script file a web/-relative module path names, or null. */
function moduleFile(path) {
  const candidates = [
    path,
    ...scriptExtensions.map((extension) => path + extension),
    ...scriptExtensions.map((extension) => `${path}/index${extension}`),
  ];
  return (
    candidates.find(
      (candidate) =>
        scriptExtensions.includes(posix.extname(candidate)) &&
        existsSync(webRoot + candidate),
    ) ?? null
  );
}

/** The module `specifier` in `importer` (both web/-relative) names, or null for a package. */
function importedModule(importer, specifier) {
  const { path } = resolveImport(importer, specifier);
  return path === null ? null : moduleFile(path);
}

const unwrap = (node) => {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "ParenthesizedExpression")
  )
    current = current.expression;
  return current;
};

const nameOf = (node) =>
  node.type === "Identifier" ? node.name : String(node.value);

/**
 * Reads a module's imports of `createContext` from react, so that a call of
 * it (by its own name, an alias or `React.createContext`) is known.
 */
function reactNames(body) {
  const direct = new Set();
  const namespaces = new Set();
  for (const node of body) {
    if (node.type !== "ImportDeclaration" || node.source.value !== "react")
      continue;
    for (const specifier of node.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        if (nameOf(specifier.imported) === "createContext")
          direct.add(specifier.local.name);
      } else namespaces.add(specifier.local.name);
    }
  }
  return { direct, namespaces };
}

/** Whether `node` is a call of react's `createContext`. */
function isCreateContext(node, react) {
  const call = unwrap(node);
  if (call?.type !== "CallExpression") return false;
  const callee = unwrap(call.callee);
  if (callee.type === "Identifier") return react.direct.has(callee.name);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    react.namespaces.has(callee.object.name) &&
    callee.property.name === "createContext"
  );
}

const cache = new Map();

/**
 * The names a module (web/-relative) exports a context under, "default"
 * included: made there with `createContext`, or imported and exported again.
 * Each module is read once.
 */
function contextExports(file, seen = new Set()) {
  const cached = cache.get(file);
  if (cached) return cached;
  if (seen.has(file)) return new Set();
  seen.add(file);
  const exported = new Set();
  const { program } = parseSync(file, readFileSync(webRoot + file, "utf8"));
  const react = reactNames(program.body);
  // Top-level bindings that hold a context: made here or imported.
  const local = new Set();
  const exportsOf = (specifier) => {
    const target = importedModule(file, specifier);
    return target ? contextExports(target, seen) : new Set();
  };
  for (const node of program.body) {
    if (node.type === "ImportDeclaration" && node.importKind !== "type") {
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportNamespaceSpecifier") continue;
        const imported =
          specifier.type === "ImportDefaultSpecifier"
            ? "default"
            : nameOf(specifier.imported);
        if (exportsOf(node.source.value).has(imported))
          local.add(specifier.local.name);
      }
    }
    const declaration =
      node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (declaration?.type === "VariableDeclaration")
      for (const declarator of declaration.declarations)
        if (
          declarator.id.type === "Identifier" &&
          isCreateContext(declarator.init, react)
        ) {
          local.add(declarator.id.name);
          if (declaration !== node) exported.add(declarator.id.name);
        }
  }
  for (const node of program.body) {
    if (node.type === "ExportNamedDeclaration" && node.exportKind !== "type") {
      const from = node.source ? exportsOf(node.source.value) : null;
      for (const specifier of node.specifiers) {
        const name = nameOf(specifier.local);
        if (from ? from.has(name) : local.has(name))
          exported.add(nameOf(specifier.exported));
      }
    } else if (node.type === "ExportAllDeclaration" && !node.exported) {
      for (const name of exportsOf(node.source.value))
        if (name !== "default") exported.add(name);
    } else if (node.type === "ExportDefaultDeclaration") {
      const value = node.declaration;
      if (
        isCreateContext(value, react) ||
        (value.type === "Identifier" && local.has(value.name))
      )
        exported.add("default");
    }
  }
  cache.set(file, exported);
  return exported;
}

/** Whether `node` builds a new object, array, function, class or `new` each time it runs. */
function constructed(node) {
  const value = unwrap(node);
  switch (value?.type) {
    case "ObjectExpression":
    case "ArrayExpression":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "ClassExpression":
    case "NewExpression":
      return value;
    case "ConditionalExpression":
      return constructed(value.consequent) ?? constructed(value.alternate);
    case "LogicalExpression":
      return constructed(value.left) ?? constructed(value.right);
    case "SequenceExpression":
      return constructed(value.expressions.at(-1));
    default:
      return null;
  }
}

/** The variable `name` names where `node` is. */
function variableAt(sourceCode, node, name) {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable) return variable;
  }
  return null;
}

export default {
  meta: { name: "context-values" },
  rules: {
    "no-constructed": {
      create(context) {
        const file = toWeb(context.filename);
        if (!isProductCode(file)) return {};
        const { sourceCode } = context;
        // Import specifiers whose binding is a context, and namespace imports
        // with the names of the contexts their module exports. A context
        // made in the file itself is the standard rule's.
        const contexts = new Set();
        const namespaces = new Map();
        const exportsOf = (specifier) => {
          const target = importedModule(file, specifier);
          return target ? contextExports(target) : new Set();
        };
        return {
          // Read before any JSX, which may come first in the file.
          Program(program) {
            for (const node of program.body) {
              if (node.type === "ImportDeclaration") {
                if (node.importKind === "type") continue;
                for (const specifier of node.specifiers) {
                  if (specifier.importKind === "type") continue;
                  if (specifier.type === "ImportNamespaceSpecifier") {
                    namespaces.set(specifier, exportsOf(node.source.value));
                    continue;
                  }
                  const imported =
                    specifier.type === "ImportDefaultSpecifier"
                      ? "default"
                      : nameOf(specifier.imported);
                  if (exportsOf(node.source.value).has(imported))
                    contexts.add(specifier);
                }
              }
            }
          },
          JSXOpeningElement(node) {
            // <X>, <X.Provider>, <ns.X> and <ns.X.Provider>.
            let name = node.name;
            if (
              name.type === "JSXMemberExpression" &&
              name.property.name === "Provider"
            )
              name = name.object;
            let isContext = false;
            if (name.type === "JSXIdentifier") {
              const definition = variableAt(sourceCode, node, name.name)
                ?.defs[0]?.node;
              isContext = contexts.has(definition);
            } else if (
              name.type === "JSXMemberExpression" &&
              name.object.type === "JSXIdentifier"
            ) {
              const definition = variableAt(sourceCode, node, name.object.name)
                ?.defs[0]?.node;
              isContext = !!namespaces.get(definition)?.has(name.property.name);
            }
            if (!isContext) return;
            for (const attribute of node.attributes) {
              if (
                attribute.type !== "JSXAttribute" ||
                attribute.name.name !== "value" ||
                attribute.value?.type !== "JSXExpressionContainer"
              )
                continue;
              const built = constructed(attribute.value.expression);
              if (built) context.report({ node: built, message });
            }
          },
        };
      },
    },
  },
};
