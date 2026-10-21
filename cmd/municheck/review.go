package main

import (
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"strings"
)

type finding struct {
	Kind     string `json:"kind"`
	Index    int    `json:"index"`
	Place    *int   `json:"place,omitempty"`
	Finding  string `json:"finding"`
	Evidence string `json:"evidence"`
	Reviewer string `json:"reviewer,omitempty"`
}

func applyFindings(results []result, path string) {
	var findings []finding
	must(readJSON(path, &findings))
	for _, f := range findings {
		matched := false
		for i := range results {
			r := &results[i]
			if r.Kind != f.Kind || r.Index != f.Index {
				continue
			}
			if f.Place != nil && (r.Source == nil || r.Source.Place != *f.Place) {
				continue
			}
			r.Finding = f.Finding
			r.Evidence = f.Evidence
			r.Reviewer = f.Reviewer
			if r.Reviewer == "" {
				r.Reviewer = "Codex（AI、保存済み画像と一覧を確認）"
			}
			matched = true
		}
		if !matched {
			must(fmt.Errorf("所見の参照先がない: %s 行%d", f.Kind, f.Index))
		}
	}
}

func writeReview(path string, doc report) error {
	t := template.Must(template.New("review").Funcs(template.FuncMap{
		"dist": func(p *float64) string {
			if p == nil {
				return "算出せず"
			}
			return fmt.Sprintf("%.1f m", *p)
		},
		"image": func(s string) string {
			p, _ := filepath.Rel(filepath.Dir(path), filepath.Join("data/raw/images", s))
			return filepath.ToSlash(p)
		},
		"crop": func(s, part string) string {
			base := strings.TrimSuffix(s, filepath.Ext(s))
			p, _ := filepath.Rel(filepath.Dir(path), filepath.Join("data/work/crops", base+"-"+part+".png"))
			return filepath.ToSlash(p)
		},
		"isDistribution": func(s string) bool { return s == "distribution" },
	}).Parse(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>自治体照合の確認候補</title>
<style>body{font-family:sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;background:#fafafa;color:#222}section{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0}h2{font-size:18px}.q{color:#b04000}.imgs{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}.imgs>img{width:260px}.imgs img{max-width:100%}.crops{max-width:580px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ddd;padding:6px;text-align:left;overflow-wrap:anywhere}pre{white-space:pre-wrap}summary{cursor:pointer}</style>
<h1>自治体照合の確認候補</h1><p>判定だけでは正誤を決めない。元の住所、座標、番号は変更していない。分類と所見は Codex（AI）による。既存の上書き記録の確認者は各行に示す。</p>
<p>①番号と座標の印字を画像と比べる。②配布場所では一覧原文と施設の対応を比べる。③原因を判断できなければ未確定のまま残す。境界付近のしきい値は {{.ThresholdM}} m。海上等は距離にかかわらず判定不能とする。</p>
<p>元画像と拡大画像はローカルファイルを参照する。このページと data/raw/images、data/work/crops を同じ配置で使う。</p>
<p>境界距離は比較対象を構成する多角形の縁までの距離である。市や県をまとめた範囲の内側では、内部の区界や市町村界までの距離も含む。境界付近の分類には、対象の外側から対象までの距離だけを使う。</p>
<p>出典：国土交通省「国土数値情報（行政区域データ）2026年版」 <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">掲載ページ</a>、<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。本リポジトリの検証処理で座標を照合して作成した。提供データは無保証であり、国がこの判定を作成したものではない。</p>
{{range .Results}}{{if or .Review (eq .ByCode.Status "対象外")}}<section id="{{.Kind}}-{{.Index}}{{with .Source}}-{{.Place}}{{end}}"><h2>{{if isDistribution .Kind}}配布場所{{else}}蓋{{end}}：行 {{.Index}} / {{.City}} / {{.Code}}</h2>
{{with .Source}}<p>{{.Name}}（{{.Condition}}）／住所借用：{{.Borrowed}}</p><p>元の住所：{{.Original}}</p>{{end}}
<p class="q">{{.Finding}}：{{.Evidence}}</p>
<table><tr><th>比較元</th><th>対象</th><th>判定</th><th>対象の境界まで</th></tr><tr><td>印字番号</td><td>{{.ByCode.Target.Label}} / {{.ByCode.Target.Scope}}</td><td>{{.ByCode.Status}} {{.ByCode.Reason}}</td><td>{{dist .ByCode.BoundaryM}}</td></tr><tr><td>一覧自治体名</td><td>{{.ByName.Target.Label}} / {{.ByName.Target.Scope}}</td><td>{{.ByName.Status}} {{.ByName.Reason}}</td><td>{{dist .ByName.BoundaryM}}</td></tr></table>
<p>座標：{{.Lat}}, {{.Lng}} ／ {{.CoordinateSource}} ／ {{.Level}}</p><p>記録した印字：{{.Printed}} ／ 番号の出典：{{.IDSource}} ／ 上書き記録の確認者：{{.OverrideReviewer}}</p>
<p>座標を含む自治体：{{range .Actual}}{{.Pref}}{{.City}}{{.Ward}}（{{.Code}}） {{else}}該当なし{{end}}</p><p>最寄りの境界：{{.Nearest.Pref}}{{.Nearest.City}}{{.Nearest.Ward}}、{{dist .NearestBoundaryM}}</p>
<p>番号と一覧の対象が重ならない：{{.TargetConflict}} ／ 技術検証3の遠い9枚：{{.FarPreviously}}</p>
<div class="imgs"><img loading="lazy" src="{{image .Image}}" alt="カード画像"><div class="crops"><img loading="lazy" src="{{crop .Image "code"}}" alt="番号拡大"><br><img loading="lazy" src="{{crop .Image "coord"}}" alt="座標拡大"></div></div>
<details><summary>保存済み一覧の配布場所原文</summary><pre>{{range .GKPPlace}}{{.}}
{{end}}</pre></details><p>所見の確認者：{{.Reviewer}}</p></section>{{end}}{{end}}</html>`))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, doc)
}
