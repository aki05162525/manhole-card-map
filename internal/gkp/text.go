package gkp

import (
	"strings"

	"golang.org/x/text/width"
)

// 見た目は同じでも別の符号位置になっている文字を、通常の漢字に戻す。
// 例: 康熙部首の「⻑」(U+2ED1) で書かれた「⻑野県」。
var lookalikes = strings.NewReplacer(
	"⻑", "長",
	"⻤", "鬼",
	"⻄", "西",
	"⻘", "青",
	"⻆", "角",
	"⻝", "食",
	"⻩", "黄",
	"⻭", "歯",
)

// cleanLine は1行の前後の空白を落とし、異体の部首文字を通常の漢字に置き換える。
func cleanLine(s string) string {
	s = strings.ReplaceAll(s, " ", " ")
	s = strings.ReplaceAll(s, "　", " ")
	return strings.TrimSpace(lookalikes.Replace(s))
}

// fold は照合用に、全角の英数字と記号を半角にそろえる（①などの丸数字は変えない）。
func fold(s string) string {
	return width.Fold.String(s)
}
