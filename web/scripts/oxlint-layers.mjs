// Oxlint JS plugin (`.oxlintrc.json`): which file of web/ may import which.
// One table names the layers, top to bottom; a file imports only the layers
// below its own, never a neighbour in its own layer, unless `exceptions` names
// the pair and says why. Static, dynamic (`import()`), re-export and type
// imports are all checked; specifiers resolve as relative paths or `@/`
// (tsconfig `paths`). npm packages, and paths outside web/ (the repository's
// data/ and tools/), are left to `no-restricted-imports` and to review.
//
// Moving a directory later (src/contract, src/session, src/entries,
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
 * out of product code (src/ and worker/ outside tests).
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
    paths: ["src/main", "src/*-main", "src/entries", "scripts/static-pages"],
    note: "HTML ごとの起動コード（src/entries は入口をまとめて試す entries.dom.test.tsx）。scripts/static-pages.tsx はビルド時に生成ページを描く入口で、後の段階で pages/card へ移す",
  },
  {
    name: "worker",
    rank: 1,
    paths: ["worker/"],
    allow: ["contract"],
    note: "Cloudflare Worker。画面のコードを取り込まず、画面と共有するのは contract だけ",
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
    note: "ログイン状態と私的 API の関門。後の段階で shared/browser・shared/url・features/account から移す（今はファイルなし）",
  },
  {
    name: "fixtures",
    rank: 6,
    paths: ["scripts/fixtures"],
    testSupport: true,
    note: "fixture ビルドのデータ。試験と tools だけが取り込む",
  },
  { name: "domain", rank: 7, paths: ["src/domain/"], note: "純粋な型と関数" },
  {
    name: "generated",
    rank: 8,
    paths: ["src/prefectures", "src/pref-borders", "src/generated/"],
    note: "tools/map の生成物",
  },
  {
    name: "contract",
    rank: 8,
    paths: ["src/shared/universal/", "src/contract/"],
    note: "画面と Worker が共有する純粋な型・規則。後の段階で src/contract へ移す",
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
    from: "src/features/friends",
    to: "src/features/account/account-api",
    reason: "一時的。私的 API の関門（account-api）が session へ移ると消える",
  },
  {
    from: "src/shared/ui/account-link",
    to: "src/shared/browser/signed-in",
    reason:
      "一時的。ヘッダーがログイン状態を表示する。signed-in が session へ移ると消える",
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

const scriptExtension = /\.(?:[cm]?[jt]sx?|json)$/;
const testSuffix = /(?:\.dom)?\.test$/;
const testFile = /\.test\.[cm]?[jt]sx?$/;

const escape = (text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

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

/** Strips the query, extension and test suffix that do not change a module's place. */
function modulePath(path) {
  return path
    .replace(/\?.*$/, "")
    .replace(scriptExtension, "")
    .replace(testSuffix, "");
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

/** The web/-relative path an import names, or null for a package or a path outside web/. */
function resolveSpecifier(importer, specifier) {
  let path;
  if (specifier.startsWith("@/")) path = "src/" + specifier.slice(2);
  else if (specifier.startsWith("./") || specifier.startsWith("../"))
    path = posix.join(posix.dirname(importer), specifier);
  else return null;
  path = posix.normalize(path);
  return path.startsWith("../") ? null : path;
}

/** Why `importer` may not import `target` (both web/-relative), or null when it may. */
export function violation(importer, target, allowed = exceptions) {
  const from = locate(importer);
  const to = locate(target);
  if (!to) {
    return target.startsWith("src/")
      ? `${target} は層の表にない。scripts/oxlint-layers.mjs の layers に足す。`
      : null;
  }
  if (!from) {
    return importer.startsWith("src/")
      ? `${importer} は層の表にない。scripts/oxlint-layers.mjs の layers に足す。`
      : null;
  }
  if (from.unit === to.unit) return null;
  const test = testFile.test(importer);
  const excused = allowed.some(
    (exception) =>
      (test || !exception.tests) &&
      within(from.module, exception.from) &&
      within(to.module, exception.to),
  );
  if (excused) return null;
  const name = (place) =>
    place.unit === place.layer.name
      ? place.layer.name
      : `${place.layer.name}（${place.unit}）`;
  if (to.layer.testSupport && !test && /^(?:src|worker)\//.test(importer))
    return `${name(to)} は試験と tools だけが取り込む。`;
  const { allow } = from.layer;
  if (allow) {
    if (allow.includes(to.layer.name)) return null;
    const reach = allow.length ? `自分の中と ${allow.join("・")} ` : "自分の中";
    return `${name(from)} が取り込めるのは${reach}だけ（${name(to)} は取り込めない）。`;
  }
  if (to.layer.rank > from.layer.rank) return null;
  if (to.layer.rank === from.layer.rank)
    return `${name(from)} は同じ層の隣 ${name(to)} を取り込まない。要るなら scripts/oxlint-layers.mjs の exceptions に理由と書く。`;
  return `${name(from)} は上の層 ${name(to)} を取り込まない。`;
}

const specifierOf = (node) => {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  return null;
};

export default {
  meta: { name: "layers" },
  rules: {
    imports: {
      create(context) {
        const importer = relative(webRoot, context.filename)
          .split(sep)
          .join("/");
        if (importer.startsWith("../")) return {};
        const check = (node) => {
          const specifier = specifierOf(node);
          if (specifier === null) return;
          const target = resolveSpecifier(importer, specifier);
          if (target === null) return;
          const message = violation(importer, target);
          if (message) context.report({ node, message });
        };
        return {
          ImportDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => check(node.source),
          ExportAllDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          TSImportType: (node) => check(node.source),
        };
      },
    },
  },
};
