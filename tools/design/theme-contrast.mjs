import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { contrastRatio, composite } from "./color-contrast.mjs";

// Read the current CSS, rather than a second copy of the production palette.
export function readLightTokens() {
  const css = readFileSync(new URL("../../web/src/shared/ui/tokens.css", import.meta.url), "utf8");
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  if (!root) throw new Error("Missing root tokens");
  return Object.fromEntries(
    [...root.matchAll(/--([\w-]+):\s*(#[\da-f]+);/gi)].map((m) => [m[1], m[2]]),
  );
}

// Rendered token pairs. Decorative separators/shadows do not identify controls.
export function lightContrastTable(tokens = readLightTokens()) {
  const rows = [];
  const add = (use, fg, bg, minimum, opacity = 1) => {
    if (!tokens[fg] || !tokens[bg]) throw new Error(`Missing token: ${fg}/${bg}`);
    const ratio = contrastRatio(
      opacity === 1 ? tokens[fg] : composite(tokens[fg], tokens[bg], opacity),
      tokens[bg],
    );
    rows.push({
      use,
      foreground: fg,
      background: bg,
      opacity,
      minimum,
      ratio,
      passes: ratio >= minimum,
    });
  };
  for (const bg of ["paper", "sheet", "pressed-bg"]) {
    for (const fg of ["ink", "ink-muted", "patina"]) add("本文・注記・リンク", fg, bg, 4.5);
    add("番号の刻印", "ink", bg, 4.5, 0.7);
    add("ロゴ・操作アイコン・主ボタン", "iron", bg, 3);
    add("未確認の記号・枠", "ink-muted", bg, 3);
  }
  add("主ボタン・件数の数字", "white", "iron", 4.5);
  add("件数の内輪", "white", "iron", 3, 0.5);
  for (const status of ["active", "upcoming", "suspended", "ended"]) {
    add("状態の文字", `${status}-ink`, `${status}-bg`, 4.5);
    add("状態の記号", `${status}-ink`, `${status}-bg`, 3);
  }
  for (const bg of ["error-bg", "sheet"]) add("エラー帯・再試行の文字", "error", bg, 4.5);
  add("検索入力・一覧入力の枠", "rule-strong", "sheet", 3);
  add("地図の通常操作の枠", "rule", "sheet", 3);
  add("0件の線画（検索）", "rule-strong", "sheet", 3);
  add("0件の線画（一覧）", "rule-strong", "paper", 3);
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = lightContrastTable();
  console.log(
    "Light theme prerequisite for Issue #147 phase 6 (unrounded ratios decide pass/fail)",
  );
  console.table(rows.map((row) => ({ ...row, ratio: row.ratio.toFixed(3) })));
  const failures = rows.filter((row) => !row.passes);
  console.log(
    `${failures.length}/${rows.length} pairs fail. ${failures.length ? "Do not introduce dark mode while light appearance is frozen." : "Light token prerequisite passed; dark and basemap checks are still required."}`,
  );
  process.exitCode = failures.length ? 1 : 0;
}
