// Oxlint JS plugin (`.oxlintrc.json`): which file of web/ may import which.
// One table names the layers, top to bottom; a file imports only the layers
// below its own, never a neighbour in its own layer, unless `exceptions` names
// the pair and says why. Static, dynamic (`import()`), re-export, type,
// `require()` and `import x = require()` imports are all checked, with the
// specifier as a string or a template without `${}`. Specifiers resolve as
// relative paths or `@/` (tsconfig `paths`); paths outside web/ (the
// repository's data/ and tools/) are rows like the rest. A row may also deny
// npm packages, and `apart` keeps the map's code out of the list and about.
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
 * out of product code (src/ and worker/ outside tests). `packages` limits the
 * npm packages (and `@/`) a row imports: `deny` names the ones it may not,
 * `only` the ones it may. An entry is a package (its subpaths included) or a
 * prefix ending in "/" or ":" (`@/`, `node:`).
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
    allow: ["contract", "ledger"],
    packages: {
      deny: ["react", "react-dom", "maplibre-gl", "@/"],
      reason: "画面の package と @/ を使わない",
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
    note: "ログイン状態と私的 API の関門。後の段階で shared/browser・shared/url・features/account から移す（今はファイルなし）",
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
    paths: ["src/shared/universal/", "src/contract/"],
    packages: {
      only: ["vitest", "node:"],
      reason: "Worker と画面の両方が取り込むので、npm package に依存しない",
    },
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

/**
 * Code that files in `from` (units or files) may not import, whatever the
 * layers say: modules in `to` (a trailing `*` matches any file name that
 * starts so) and the packages in `packages`. Tests included.
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

/** Whether a package specifier is one of `entries` (a package with its subpaths, or a prefix). */
const named = (specifier, entries) =>
  entries.some((entry) =>
    /[/:]$/.test(entry)
      ? specifier.startsWith(entry)
      : within(specifier, entry),
  );

/**
 * The web/-relative path an import names (starting with "../" outside web/),
 * or null for a package.
 */
function resolveSpecifier(importer, specifier) {
  let path;
  if (specifier.startsWith("@/")) path = "src/" + specifier.slice(2);
  else if (specifier.startsWith("./") || specifier.startsWith("../"))
    path = posix.join(posix.dirname(importer), specifier);
  else return null;
  return posix.normalize(path);
}

const unlisted = (path) =>
  `${path} は層の表にない。scripts/oxlint-layers.mjs の layers に足す。`;

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
  if (!from)
    return importer.startsWith("src/") ? { message: unlisted(importer) } : null;
  const target = resolveSpecifier(importer, specifier);
  const kept = apart.find(
    (rule) =>
      rule.from.some((unit) => within(from.module, unit)) &&
      (target === null
        ? named(specifier, rule.packages)
        : rule.to.some((entry) =>
            entry.endsWith("*")
              ? modulePath(target).startsWith(entry.slice(0, -1))
              : within(modulePath(target), entry),
          )),
  );
  if (kept) return { message: `${kept.reason}。` };
  const rule = from.layer.packages;
  if (rule && !specifier.startsWith(".")) {
    const banned = rule.deny
      ? named(specifier, rule.deny)
      : !named(specifier, rule.only);
    if (banned)
      return {
        message: `${describePlace(from)} は ${specifier} を取り込まない（${rule.reason}）。`,
      };
  }
  if (target === null) return null;
  const to = locate(target);
  if (!to)
    return /^(?:src\/|\.\.\/)/.test(target)
      ? { message: unlisted(target) }
      : null;
  if (from.unit === to.unit) return null;
  const test = testFile.test(importer);
  const exception = allowed.find(
    (candidate) =>
      (test || !candidate.tests) &&
      within(from.module, candidate.from) &&
      within(to.module, candidate.to),
  );
  if (exception) return { exception };
  if (to.layer.testSupport && !test && /^(?:src|worker)\//.test(importer))
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
          const message = importer.startsWith("src/")
            ? unlisted(importer)
            : null;
          return message
            ? { Program: (node) => context.report({ node, message }) }
            : {};
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
