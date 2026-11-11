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
  // Account pages: the warning's icon, the danger button and invalid field borders.
  add("操作の非文字", "復旧の注意の記号", "suspended-ink", "suspended-bg");
  add("操作の非文字", "削除ボタン・誤りのある入力欄の枠", "error", "sheet");
  return rows;
}

// Read the WebGL palette too: no second copy of its colors in the audit.
export function readMapPalette(theme) {
  if (!["light", "dark"].includes(theme)) throw new Error("Unknown theme");
  const source = readFileSync(
    new URL("../../web/src/features/map/map-theme.ts", import.meta.url),
    "utf8",
  );
  const body = source.match(new RegExp(`const ${theme}[^=]*= \\{([\\s\\S]*?)^};`, "m"))?.[1];
  if (!body) throw new Error("Missing WebGL palette");
  const base = Object.fromEntries(
    [...body.matchAll(/^  (\w+): "(#[\da-f]+)"/gm)].map((m) => [m[1], m[2]]),
  );
  const pinSource =
    theme === "dark"
      ? body.match(/pins: \{([\s\S]*?)\}/)?.[1]
      : readFileSync(new URL("../../web/src/features/map/types.ts", import.meta.url), "utf8").match(
          /export const colors[^=]*= \{([\s\S]*?)^};/m,
        )?.[1];
  const pins = Object.fromEntries(
    [...(pinSource ?? "").matchAll(/(\w+): "(#[\da-f]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const inactivePinOpacity = Number(body.match(/inactivePinOpacity: ([\d.]+)/)?.[1]);
  if (
    [
      "land",
      "water",
      "building",
      "green",
      "road",
      "roadEdge",
      "label",
      "pinRim",
      "selection",
    ].some((k) => !base[k]) ||
    Object.keys(pins).length !== 5 ||
    !Number.isFinite(inactivePinOpacity)
  )
    throw new Error("Incomplete WebGL palette");
  return { ...base, pins, inactivePinOpacity };
}

export function mapContrastTable(palette, dark) {
  const rows = [];
  const add = (category, use, foreground, background, minimum, opacity = 1) => {
    const ratio = contrastRatio(
      opacity === 1 ? foreground : composite(foreground, background, opacity),
      background,
    );
    rows.push({
      category,
      use,
      foreground,
      background,
      minimum,
      opacity,
      ratio,
      passes: ratio >= minimum,
    });
  };
  add("背景（識別目安）", "A3 陸と水", palette.land, palette.water, 1.2);
  add("文字", "A3 水上の地名", palette.label, palette.water, 4.5);
  add("操作の非文字", "選択の白い外輪と照準", "#ffffff", palette.selection, 3);
  for (const [status, color] of Object.entries(palette.pins)) {
    for (const bg of ["paper", "sheet"]) {
      add("操作の非文字", `凡例 ${status}`, color, readThemeTokens(dark ? "dark" : "light")[bg], 3);
    }
    // The rim is background-colored spacing; the colored square carries the
    // component boundary. It must contrast with both the rim and the map.
    add("操作の非文字", `A1 ${status}の記号と縁`, color, palette.pinRim, 3);
    for (const background of [
      palette.land,
      palette.water,
      palette.building,
      palette.green,
      palette.road,
      palette.roadEdge,
    ]) {
      add("操作の非文字", `A1 ${status}と地図`, color, background, 3);
      if (dark)
        add(
          "操作の非文字",
          `A1 非選択県の${status}と地図`,
          color,
          background,
          3,
          palette.inactivePinOpacity,
        );
    }
  }
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failures = 0;
  for (const theme of ["light", "dark"]) {
    const rows = [
      ...themeContrastTable(readThemeTokens(theme)),
      ...mapContrastTable(readMapPalette(theme), theme === "dark"),
    ];
    console.log(theme);
    console.table(rows.map((row) => ({ ...row, ratio: row.ratio.toFixed(3) })));
    failures += rows.filter((row) => !row.passes).length;
  }
  console.log(`${failures} failing pairs (unrounded ratios decide pass/fail)`);
  process.exitCode = failures ? 1 : 0;
}
