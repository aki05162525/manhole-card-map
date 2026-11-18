import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "oxlint/plugins-dev";
import { afterAll, beforeAll, describe, expect, it, test } from "vitest";
import plugin, { exceptions, locate, violation } from "./oxlint-layers.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const web = fileURLToPath(new URL("..", import.meta.url));
const at = (path: string) => web + path;
const tester = new RuleTester({ languageOptions: { sourceType: "module" } });

const valid = (filename: string, code: string) => ({
  filename: at(filename),
  code,
});
const invalid = (filename: string, code: string, message: RegExp) => ({
  filename: at(filename),
  code,
  errors: [{ message }],
});

tester.run("layers/imports", plugin.rules.imports, {
  valid: [
    // Downward, across several layers, by relative path and by `@/`.
    valid("src/pages/map/map-page.tsx", `import "../../features/map/x";`),
    valid("src/pages/map/map-page.tsx", `import "@/features/map/x";`),
    valid("src/main.ts", `import "./domain/types";`),
    valid("src/shared/url/catalog-url.ts", `import "../../prefectures";`),
    valid(
      "src/features/map/map-runtime.ts",
      `import u from "../../pref-borders.json?url";`,
    ),
    valid("src/domain/records.ts", `import "../shared/universal/calendar";`),
    // Within one unit.
    valid("src/pages/map/map-page.tsx", `import "./use-detail-sheet";`),
    valid("src/components/ui/map.tsx", `import "../../lib/utils";`),
    // Dynamic import downward, by literal and by plain template.
    valid("src/app/app.tsx", "const m = import(`../pages/about/about-page`);"),
    // Packages a row does not deny.
    valid("src/pages/map/map-page.tsx", `import "maplibre-gl";`),
    valid("src/domain/types.ts", `import "@/shared/universal/calendar";`),
    valid("src/shared/universal/x.test.ts", `import { it } from "vitest";`),
    valid("src/contract/x.ts", `import "node:crypto";`),
    valid("worker/index.ts", `import { Hono } from "hono";`),
    // The repository's data/ for product code and the Worker; its tools/
    // for tests and web/ tools.
    valid(
      "src/pages/about/about-credits.ts",
      `import "../../../../data/card-images.json";`,
    ),
    valid("worker/card-ids.ts", `import "../../data/card-ids.json";`),
    valid(
      "src/features/map/map-theme.test.ts",
      `import "../../../../tools/design/color-contrast.mjs";`,
    ),
    valid(
      "scripts/color-contrast.test.ts",
      `import "../../tools/design/color-contrast.mjs";`,
    ),
    // require and \`import x = require()\` follow the same table.
    valid("src/app/app.tsx", `const m = require("../pages/map/map-page");`),
    // Listed exceptions, one of them only for tests.
    valid(
      "src/features/card-detail/card-detail.tsx",
      `import "../records/records-entry";`,
    ),
    valid(
      "src/features/records/records.dom.test.tsx",
      `import("../card-detail/card-detail");`,
    ),
    // Worker reaches contract only; tools reach anything.
    valid("worker/encoding.ts", `import "../src/shared/universal/encoding";`),
    valid(
      "scripts/check-deploy.mjs",
      `import "../src/pages/about/about-summary.ts";`,
    ),
    // fixtures: tests and tools, not product code.
    valid(
      "src/pages/cards/cards-page.test.ts",
      `import "../../../scripts/fixtures";`,
    ),
    valid("vite.config.ts", `import "./scripts/fixtures.ts";`),
  ],
  invalid: [
    invalid(
      "src/features/map/card-map.tsx",
      `import "../../pages/map/map-page";`,
      /上の層 pages（src\/pages\/map）/,
    ),
    invalid(
      "src/domain/types.ts",
      `import "@/shared/ui/labels";`,
      /上の層 shared/,
    ),
    invalid(
      "src/pages/cards/cards-page.tsx",
      `import "../map/map-page";`,
      /同じ層の隣 pages（src\/pages\/map）/,
    ),
    invalid(
      "src/features/map/card-map.tsx",
      `import "@/features/card-detail/card-detail";`,
      /同じ層の隣/,
    ),
    invalid(
      "src/shared/ui/labels.ts",
      `import "../url/catalog-url";`,
      /同じ層の隣 shared（src\/shared\/url）/,
    ),
    invalid(
      "src/shared/universal/calendar.ts",
      `import "../../prefectures";`,
      /同じ層の隣 generated/,
    ),
    invalid(
      "src/domain/records.ts",
      `import "../session/api";`,
      /上の層 session/,
    ),
    // An exception covers the named file, not its whole unit.
    invalid(
      "src/features/card-detail/card-detail.tsx",
      `import "../records/records-context";`,
      /同じ層の隣/,
    ),
    // A test-only exception does not cover the product file.
    invalid(
      "src/features/records/records-entry.tsx",
      `import("../card-detail/card-detail");`,
      /同じ層の隣/,
    ),
    // Dynamic import, re-export and type import are imports too.
    invalid(
      "src/features/map/card-map.tsx",
      "const m = import(`../../app/app`);",
      /上の層 app/,
    ),
    invalid(
      "src/features/map/x.ts",
      `export { y } from "../../pages/map/y";`,
      /上の層 pages/,
    ),
    invalid(
      "src/features/map/x.ts",
      `export * from "../../app/app";`,
      /上の層 app/,
    ),
    invalid(
      "src/domain/x.ts",
      `type T = import("../features/map/y").Y;`,
      /上の層 features/,
    ),
    // Worker takes contract only; nothing in src takes the worker.
    invalid(
      "worker/auth.ts",
      `import "../src/domain/records";`,
      /worker が取り込めるのは自分の中と contract・ledger だけ/,
    ),
    invalid("src/app/app.tsx", `import "../../worker/auth";`, /上の層 worker/),
    // mapcn stays self-contained.
    invalid(
      "src/components/ui/map.tsx",
      `import "../../domain/types";`,
      /mapcn が取り込めるのは自分の中だけ/,
    ),
    // Product code does not take fixtures or tools.
    invalid(
      "src/pages/cards/cards-page.tsx",
      `import "../../../scripts/fixtures";`,
      /fixtures は試験と tools だけ/,
    ),
    invalid(
      "src/features/map/x.ts",
      `import "../../../scripts/data-version";`,
      /上の層 tools/,
    ),
    // domain and contract take nothing from outside web/: not the ledger,
    // not the repository's tools, not a path the table does not name.
    invalid(
      "src/domain/probe.ts",
      `import "../../../data/card-images.json";`,
      /domain は上の層 ledger/,
    ),
    invalid(
      "src/domain/probe.ts",
      `import "../../../tools/design/color-contrast.mjs";`,
      /devtools は試験と tools だけ/,
    ),
    invalid(
      "src/shared/universal/x.ts",
      `import "../../../../data/card-ids.json";`,
      /contract は上の層 ledger/,
    ),
    invalid(
      "src/contract/x.ts",
      `import "../../../internal/x.json";`,
      /\.\.\/internal\/x.json は層の表にない/,
    ),
    // The repository's tools/ is for tests, not product code.
    invalid(
      "src/features/map/map-theme.ts",
      `import "../../../../tools/design/color-contrast.mjs";`,
      /devtools は試験と tools だけ/,
    ),
    invalid(
      "src/components/ui/map.tsx",
      `import "../../../../data/card-ids.json";`,
      /mapcn が取り込めるのは自分の中だけ/,
    ),
    // require and \`import x = require()\`, by literal and by plain template.
    invalid(
      "src/features/map/probe.ts",
      `const app = require("../../app/app");`,
      /上の層 app/,
    ),
    invalid(
      "src/features/map/probe.ts",
      "const app = require(`../../app/app`);",
      /上の層 app/,
    ),
    invalid(
      "src/features/map/probe.ts",
      `import app = require("../../app/app");`,
      /上の層 app/,
    ),
    // Packages a row denies, in every import form.
    invalid("src/domain/x.ts", `import "react";`, /domain は react/),
    invalid(
      "src/domain/x.ts",
      "const m = import(`react-dom/client`);",
      /domain は react-dom\/client/,
    ),
    invalid(
      "src/domain/x.ts",
      `const m = require("maplibre-gl");`,
      /domain は maplibre-gl/,
    ),
    invalid(
      "src/shared/universal/x.ts",
      `import "react";`,
      /contract は react/,
    ),
    invalid("src/contract/x.ts", `import "react";`, /contract は react/),
    invalid("worker/x.ts", `import "react-dom";`, /worker は react-dom/),
    invalid(
      "worker/x.ts",
      `import "@/shared/universal/calendar";`,
      /worker は @\/shared\/universal\/calendar/,
    ),
    // The list and about pages, and the detail and data they use, keep the
    // map's code out in every import form.
    invalid(
      "src/pages/cards/probe.ts",
      "const m = import(`../../features/map/map-runtime`);",
      /地図のコードと maplibre-gl を取り込まない/,
    ),
    invalid(
      "src/pages/about/probe.ts",
      "const m = import(`maplibre-gl`);",
      /地図のコードと maplibre-gl を取り込まない/,
    ),
    invalid(
      "src/features/card-detail/probe.ts",
      `import "@/components/ui/map";`,
      /地図のコードと maplibre-gl を取り込まない/,
    ),
    invalid(
      "src/features/card-data/probe.test.ts",
      `const m = require("maplibre-gl/dist/maplibre-gl.css");`,
      /地図のコードと maplibre-gl を取り込まない/,
    ),
    // A place the table does not cover is reported, not passed, even when
    // the file imports nothing local or nothing at all.
    invalid(
      "src/newdir/x.ts",
      `import "../domain/types";`,
      /src\/newdir\/x.ts は層の表にない/,
    ),
    invalid(
      "src/unknown/probe.ts",
      `import "react";`,
      /src\/unknown\/probe.ts は層の表にない/,
    ),
    invalid(
      "src/unknown/probe.ts",
      `export const x = 1;`,
      /src\/unknown\/probe.ts は層の表にない/,
    ),
    invalid(
      "src/app/app.tsx",
      `import "../newdir/x";`,
      /src\/newdir\/x は層の表にない/,
    ),
  ],
});

test("locates moved layers by their rows without changing the rule", () => {
  expect(locate("src/contract/calendar.ts")?.layer.name).toBe("contract");
  expect(locate("src/session/api.ts")?.layer.name).toBe("session");
  expect(locate("scripts/static-pages.tsx")?.layer.name).toBe("entries");
  expect(locate("src/card-record-main.dom.test.tsx")?.layer.name).toBe(
    "entries",
  );
});

test.each(exceptions)(
  "exception $from → $to names existing files the layers would forbid",
  (exception) => {
    const exists = (path: string) =>
      ["", ".ts", ".tsx", ".mjs"].some((ext) => existsSync(at(path + ext)));
    expect(exists(exception.from)).toBe(true);
    expect(exists(exception.to)).toBe(true);
    const importer = exception.from + (exception.tests ? ".test.ts" : "/x.ts");
    const others = exceptions.filter((other) => other !== exception);
    expect(violation(importer, exception.to)).toBeNull();
    expect(violation(importer, exception.to, others)).not.toBeNull();
  },
);

// Each exception must still excuse a real import: lint the tree with the
// exceptions reported instead of applied, and find each one in the output.
describe("exceptions in use", () => {
  let config = "";
  let used: string[] = [];
  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), "oxlint-layers-"));
    config = join(dir, "oxlintrc.json");
    writeFileSync(
      config,
      JSON.stringify({
        categories: {},
        plugins: [],
        jsPlugins: [at("scripts/oxlint-layers.mjs")],
        rules: { "layers/imports": ["warn", { exceptions: "report" }] },
      }),
    );
    const output = execFileSync(
      at("node_modules/.bin/oxlint"),
      [
        "-c",
        config,
        "--disable-nested-config",
        "--format",
        "json",
        "src",
        "scripts",
        "worker",
      ],
      { cwd: web, encoding: "utf8" },
    );
    const report = JSON.parse(output) as {
      diagnostics: { message: string }[];
    };
    used = report.diagnostics.map((diagnostic) => diagnostic.message);
  }, 60_000);
  afterAll(() => {
    if (config) rmSync(join(config, ".."), { recursive: true, force: true });
  });

  test.each(exceptions)(
    "exception $from → $to excuses an import in the tree",
    (exception) => {
      expect(used).toContain(`例外 ${exception.from} → ${exception.to}`);
    },
  );
});
