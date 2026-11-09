import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { contrastRatio, composite } from "./color-contrast.mjs";

export function readThemeTokens(theme) {
  const css = readFileSync(new URL("../../web/src/shared/ui/tokens.css", import.meta.url), "utf8");
  const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
  const dark = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]+)\}/)?.[1];
  if (!root || !dark) throw new Error("Missing theme tokens");
  if (!["light", "dark"].includes(theme)) throw new Error("Unknown theme");
  const values = (text) =>
    Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[\da-f]+);/gi)].map((m) => [m[1], m[2]]));
  return { ...values(root), ...(theme === "dark" ? values(dark) : {}) };
}

// Decorative rules/shadows do not identify controls. Aria-hidden art has a
// separate visibility target, not a WCAG 1.4.11 requirement.
export function themeContrastTable(tokens) {
  const rows = [];
  const add = (category, use, fg, bg, opacity = 1) => {
    if (!tokens[fg] || !tokens[bg]) throw new Error(`Missing token: ${fg}/${bg}`);
    const minimum = { 文字: 4.5, 操作の非文字: 3, "装飾（対象外）": 1.5 }[category];
    const ratio = contrastRatio(
      opacity === 1 ? tokens[fg] : composite(tokens[fg], tokens[bg], opacity),
      tokens[bg],
    );
    rows.push({
      category,
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
    for (const fg of ["ink", "ink-muted", "patina"])
      add("文字", "本文・注記・入力ヒント・リンク", fg, bg);
    add("文字", "番号の刻印", "ink", bg, 0.7);
    add("操作の非文字", "ロゴ・フォーカス・主ボタン", "iron", bg);
    add("操作の非文字", "未確認の記号・枠", "ink-muted", bg);
    add("操作の非文字", "入力・ボタン・select・県チップ・取っ手", "control-border", bg);
    add("装飾（対象外）", "0件の線画", "rule-strong", bg);
  }
  add("文字", "主ボタン・件数の数字", "on-iron", "iron");
  add("文字", "既存の面色を使う主ボタン", "on-iron-soft", "iron");
  add("装飾（対象外）", "件数の内輪", "on-iron", "iron", 0.5);
  add("装飾（対象外）", "aboutの蓋", "iron", "paper");
  add("装飾（対象外）", "404のロゴ", "ink-muted", "paper");
  for (const status of ["active", "upcoming", "suspended", "ended"]) {
    add("文字", "状態チップ・状態帯", `${status}-ink`, `${status}-bg`);
    add("操作の非文字", "状態の記号", `${status}-ink`, `${status}-bg`);
  }
  for (const bg of ["paper", "sheet"]) {
    add("文字", "未確認の凡例", "unknown-pin", bg);
    add("文字", "予定の凡例", "upcoming-ink", bg);
  }
  for (const bg of ["error-bg", "sheet"]) {
    add("文字", "エラー帯・再試行の文字", "error", bg);
    add("操作の非文字", "再試行の枠", "control-border", bg);
  }
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failures = 0;
  for (const theme of ["light", "dark"]) {
    const rows = themeContrastTable(readThemeTokens(theme));
    console.log(theme);
    console.table(rows.map((row) => ({ ...row, ratio: row.ratio.toFixed(3) })));
    failures += rows.filter((row) => !row.passes).length;
  }
  console.log(`${failures} failing pairs (unrounded ratios decide pass/fail)`);
  process.exitCode = failures ? 1 : 0;
}
