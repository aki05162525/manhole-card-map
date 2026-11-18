// Oxlint JS plugin (`.oxlintrc.json`): which file of web/ may import which.
// One table names the layers, top to bottom; a file imports only the layers
// below its own, never a neighbour in its own layer, unless `exceptions` names
// the pair and says why. Static, dynamic (`import()`), re-export, type,
// `require()` and `import x = require()` imports are all checked, with the
// specifier as a string or a template without `${}`. A specifier loses Vite's
// query (`?raw`, `?url`, `?worker`) and resolves as a relative path, `@/`
// (tsconfig `paths`) or `/` (Vite's root, web/); paths outside web/ (the
// repository's data/ and tools/) are rows like the rest, and a local path no
// row covers is reported. A row may also limit npm packages, and `apart` keeps
// the map's code out of the list and about.
//
// Moving a directory later (src/entries,
// src/generated) means changing a row's `paths`, not the rule.
import { fileURLToPath } from "node:url";
import { posix, relative, sep } from "node:path";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * The layers, top first. A file may import any row with a larger `rank`;
 * rows of the same rank are neighbours. A path ending in "/" is a directory,
 * and `*` in it makes each matched directory its own unit (pages/map and
 * pages/cards are neighbours). Other paths are files, without extension, and
 * belong to one unit with the rest of the row. The longest matching path wins.
 * `allow` limits a row to the layers named there; `testSupport` keeps a row
 * out of product code (src/ and worker/ outside tests). `packages` limits the
 * npm packages (and `@/`, `/`) a row imports: `deny` names the packages it may
 * not, their subpaths included; `only` names the specifiers it may, exactly.
 * In both, an entry ending in "/" or ":" is a prefix (`@/`, `node:`).
 */
export const layers = [
  {
    name: "tools",
    rank: 0,
    paths: ["scripts/", "*"],
    note: "ビルド・配信・検査の Node スクリプトと設定ファイル。どこでも取り込めて、製品コードからは取り込まれない",
  },
  {
    name: "entries",
    rank: 1,
    paths: ["src/main", "src/*-main", "src/entries"],
    note: "HTML ごとの起動コード（src/entries は入口をまとめて試す entries.dom.test.tsx）",
  },
  {
    name: "worker",
    rank: 1,
    paths: ["worker/"],
    allow: ["contract", "ledger"],
    packages: {
      deny: ["react", "react-dom", "maplibre-gl", "@/", "/"],
      reason: "画面の package と、Vite の別名 @/・ルート相対パスを使わない",
    },
    note: "Cloudflare Worker。画面のコードを取り込まず、画面と共有するのは contract（と台帳データ）だけ",
  },
  { name: "app", rank: 2, paths: ["src/app/"], note: "画面の切り替え" },
  {
    name: "pages",
    rank: 3,
    paths: ["src/pages/*/"],
    note: "画面ごとの組み立て",
  },
  {
    name: "features",
    rank: 4,
    paths: ["src/features/*/"],
    note: "機能。機能同士はページが組み立てる",
  },
  {
    name: "shared",
    rank: 5,
    paths: ["src/shared/*/"],
    note: "画面の共通補助（browser・ui・url は隣同士）",
  },
  {
    name: "mapcn",
    rank: 5,
    paths: ["src/components/ui/", "src/lib/"],
    allow: [],
    note: "mapcn 由来のファイル。自分の中（components/ui → lib）と npm package だけを取り込む",
  },
  {
    name: "session",
    rank: 6,
    paths: ["src/session/"],
    note: "ログイン状態と私的 API の関門",
  },
  {
    name: "fixtures",
    rank: 6,
    paths: ["scripts/fixtures"],
    testSupport: true,
    note: "fixture ビルドのデータ。試験と tools だけが取り込む",
  },
  {
    name: "ledger",
    rank: 7,
    paths: ["../data/"],
    note: "web/ の外の台帳データ（リポジトリの data/）。画面と Worker が読み、domain と contract は値を受け取るだけにする",
  },
  {
    name: "devtools",
    rank: 7,
    paths: ["../tools/"],
    testSupport: true,
    note: "web/ の外の開発ツール（リポジトリの tools/）。試験と tools だけが取り込む",
  },
  {
    name: "domain",
    rank: 8,
    paths: ["src/domain/"],
    packages: {
      deny: ["react", "react-dom", "maplibre-gl"],
      reason: "純粋な型と関数だけを持ち、画面と地図の package に依存しない",
    },
    note: "純粋な型と関数",
  },
  {
    name: "generated",
    rank: 9,
    paths: ["src/prefectures", "src/pref-borders", "src/generated/"],
    note: "tools/map の生成物",
  },
  {
    name: "contract",
    rank: 9,
    paths: ["src/contract/"],
    packages: {
      only: ["vitest", "node:"],
      reason: "Worker と画面の両方が取り込むので、npm package に依存しない",
    },
    note: "画面と Worker が共有する純粋な型・規則",
  },
];

/**
 * Imports the layers forbid but the code keeps, each with its reason.
 * `from` and `to` are a unit or a file (without extension); `tests` limits an
 * exception to test files.
 */
export const exceptions = [
  {
    from: "src/features/card-detail",
    to: "src/features/records/records-entry",
    reason: "詳細の中に受け取り記録の欄（記録の操作と編集）を描く",
  },
  {
    from: "src/features/card-detail",
    to: "src/features/records/records-context",
    tests: true,
    reason: "詳細の記録欄を、記録の文脈（RecordsContext）を渡して試す",
  },
  {
    from: "src/features/friends",
    to: "src/features/records",
    reason: "フレンドの記録を自分の記録と同じ文脈・部品・CSS で地図に描く",
  },
  {
    from: "src/features/records",
    to: "src/features/card-detail/card-detail",
    tests: true,
    reason:
      "スタンプの詳細を CardDetail に記録の文脈を渡して試す。試験を card-detail 側へ移すと消える",
  },
  {
    from: "worker/auth",
    to: "scripts/reconcile-tombstones",
    tests: true,
    reason: "削除の墓標の照合を、配信が使うスクリプトの関数で試す",
  },
];

/**
 * Code that files in `from` (units or files) may not import, whatever the
 * layers say: modules in `to` (a trailing `*` matches any file name that
 * starts so) and the packages in `packages` (with their subpaths, as `deny`).
 * Tests included.
 */
export const apart = [
  {
    from: [
      "src/pages/cards",
      "src/pages/about",
      "src/features/card-detail",
      "src/features/card-data",
    ],
    to: ["src/features/map", "src/components/ui/map*"],
    packages: ["maplibre-gl"],
    reason:
      "一覧と about、それらが使う詳細・データの機能は地図のコードと maplibre-gl を取り込まない（保証はビルド後の scripts/check-deploy.mjs）",
  },
];

/**
 * Test helpers: files of product directories that only tests use (fakes,
 * test data, harnesses). Like the `testSupport` rows, they are imported by
 * tests, by other helpers and by tools, never by product code, not even from
 * the helper's own unit. A helper counts as test code for the rest of the
 * table. `names` match a file name without extension.
 */
export const testHelpers = {
  paths: ["src/", "worker/"],
  names: ["fake-*", "test-*"],
  note: "fake-maplibre.ts・fake-adapter.ts・test-data.ts・test-harness.ts などテストだけが使う補助",
};

const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const scriptExtension = /\.(?:[cm]?[jt]sx?|json)$/;
const testSuffix = /(?:\.dom)?\.test$/;
const testFile = /\.test\.[cm]?[jt]sx?$/;
const helperName = new RegExp(
  `^(?:${testHelpers.names
    .map((name) => escape(name).replaceAll("*", "[^/]*"))
    .join("|")})$`,
);

/** Whether a web/-relative path is a test helper. */
export function isTestHelper(path) {
  const module = path.replace(scriptExtension, "");
  return (
    !testSuffix.test(module) &&
    testHelpers.paths.some((prefix) => module.startsWith(prefix)) &&
    helperName.test(posix.basename(module))
  );
}

const matchers = layers
  .flatMap((layer) =>
    layer.paths.map((path) => {
      const directory = path.endsWith("/");
      const body = escape(directory ? path.slice(0, -1) : path).replaceAll(
        "*",
        "[^/]+",
      );
      return {
        layer,
        length: path.length,
        pattern: new RegExp(directory ? `^(${body})(?:/|$)` : `^${body}$`),
        unit: (match) =>
          directory && path.includes("*") ? match[1] : layer.name,
      };
    }),
  )
  .sort((a, b) => b.length - a.length);

/** Strips the extension and test suffix that do not change a module's place. */
function modulePath(path) {
  return path.replace(scriptExtension, "").replace(testSuffix, "");
}

/** Finds the layer and unit of a path relative to web/, or null when no row covers it. */
export function locate(path) {
  const module = modulePath(path);
  for (const matcher of matchers) {
    const match = matcher.pattern.exec(module);
    if (match)
      return { layer: matcher.layer, unit: matcher.unit(match), module };
  }
  return null;
}

const within = (module, prefix) =>
  module === prefix || module.startsWith(prefix + "/");

const isPrefix = (entry) => /[/:]$/.test(entry);

/** Whether a package name is one of `entries`, a package with its subpaths or a prefix. */
const covered = (name, entries) =>
  entries.some((entry) =>
    isPrefix(entry) ? name.startsWith(entry) : within(name, entry),
  );

/** Whether a package name is one of `entries` exactly, or under a prefix. */
const listed = (name, entries) =>
  entries.some((entry) =>
    isPrefix(entry) ? name.startsWith(entry) : name === entry,
  );

/**
 * What `specifier`, written in `importer` (web/-relative), names once Vite's
 * query is gone: `{ name, path }`, where `path` is web/-relative (starting
 * with "../" outside web/) for a local module and null for a package.
 */
function resolveImport(importer, specifier) {
  const name = specifier.replace(/\?.*$/, "");
  let path = null;
  if (name.startsWith("@/")) path = "src/" + name.slice(2);
  else if (name.startsWith("/")) path = name.slice(1);
  else if (/^\.\.?(?:\/|$)/.test(name))
    path = posix.join(posix.dirname(importer), name);
  return { name, path: path === null ? null : posix.normalize(path) };
}

const unlisted = (path) =>
  `${path} は層の表にない。取り込むなら scripts/oxlint-layers.mjs の layers に足す。`;

const describePlace = (place) =>
  place.unit === place.layer.name
    ? place.layer.name
    : `${place.layer.name}（${place.unit}）`;

/**
 * How the table judges `importer` (web/-relative) importing `specifier` as
 * written: `{ message }` when it may not, `{ exception }` when only an
 * exception lets it, null when it may.
 */
export function judge(importer, specifier, allowed = exceptions) {
  const from = locate(importer);
  if (!from) return { message: unlisted(importer) };
  const { name, path: target } = resolveImport(importer, specifier);
  const kept = apart.find(
    (rule) =>
      rule.from.some((unit) => within(from.module, unit)) &&
      (target === null
        ? covered(name, rule.packages)
        : rule.to.some((entry) =>
            entry.endsWith("*")
              ? modulePath(target).startsWith(entry.slice(0, -1))
              : within(modulePath(target), entry),
          )),
  );
  if (kept) return { message: `${kept.reason}。` };
  const rule = from.layer.packages;
  if (rule && !name.startsWith(".")) {
    const banned = rule.deny
      ? covered(name, rule.deny)
      : !listed(name, rule.only);
    if (banned)
      return {
        message: `${describePlace(from)} は ${name} を取り込まない（${rule.reason}）。`,
      };
  }
  if (target === null) return null;
  const to = locate(target);
  if (!to) return { message: unlisted(target) };
  const test = testFile.test(importer) || isTestHelper(importer);
  const product = !test && /^(?:src|worker)\//.test(importer);
  // Before the same-unit pass: a helper sits beside the code it fakes.
  if (product && isTestHelper(target))
    return {
      message: `テスト補助 ${modulePath(target)} は試験とテスト補助だけが取り込む（scripts/oxlint-layers.mjs の testHelpers）。`,
    };
  if (from.unit === to.unit) return null;
  const exception = allowed.find(
    (candidate) =>
      (test || !candidate.tests) &&
      within(from.module, candidate.from) &&
      within(to.module, candidate.to),
  );
  if (exception) return { exception };
  if (to.layer.testSupport && product)
    return { message: `${describePlace(to)} は試験と tools だけが取り込む。` };
  const { allow } = from.layer;
  if (allow) {
    if (allow.includes(to.layer.name)) return null;
    const reach = allow.length ? `自分の中と ${allow.join("・")} ` : "自分の中";
    return {
      message: `${describePlace(from)} が取り込めるのは${reach}だけ（${describePlace(to)} は取り込めない）。`,
    };
  }
  if (to.layer.rank > from.layer.rank) return null;
  if (to.layer.rank === from.layer.rank)
    return {
      message: `${describePlace(from)} は同じ層の隣 ${describePlace(to)} を取り込まない。要るなら scripts/oxlint-layers.mjs の exceptions に理由と書く。`,
    };
  return {
    message: `${describePlace(from)} は上の層 ${describePlace(to)} を取り込まない。`,
  };
}

/** Why `importer` may not import `target` (both web/-relative), or null when it may. */
export function violation(importer, target, allowed = exceptions) {
  const specifier = posix.relative(posix.dirname(importer), target);
  const result = judge(
    importer,
    specifier.startsWith(".") ? specifier : "./" + specifier,
    allowed,
  );
  return result?.message ?? null;
}

const specifierOf = (node) => {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  return null;
};

const exceptionLabel = (exception) =>
  `例外 ${exception.from} → ${exception.to}`;

export default {
  meta: { name: "layers" },
  rules: {
    imports: {
      meta: {
        schema: [
          {
            type: "object",
            properties: { exceptions: { enum: ["apply", "report"] } },
            additionalProperties: false,
          },
        ],
      },
      create(context) {
        const importer = relative(webRoot, context.filename)
          .split(sep)
          .join("/");
        if (importer.startsWith("../")) return {};
        // "report" lists each import an exception lets through, so a test can
        // find the exceptions no import uses any more.
        const reportExceptions = context.options[0]?.exceptions === "report";
        if (!locate(importer)) {
          const message = unlisted(importer);
          return { Program: (node) => context.report({ node, message }) };
        }
        const check = (node) => {
          const specifier = specifierOf(node);
          if (specifier === null) return;
          const result = judge(importer, specifier);
          if (result?.message)
            context.report({ node, message: result.message });
          else if (result?.exception && reportExceptions)
            context.report({ node, message: exceptionLabel(result.exception) });
        };
        return {
          ImportDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => check(node.source),
          ExportAllDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          TSImportType: (node) => check(node.source),
          TSImportEqualsDeclaration: (node) => {
            if (node.moduleReference.type === "TSExternalModuleReference")
              check(node.moduleReference.expression);
          },
          CallExpression: (node) => {
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "require"
            )
              check(node.arguments[0]);
          },
        };
      },
    },
  },
};
