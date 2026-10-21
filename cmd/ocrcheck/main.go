// ocrcheck は、取得済みのカード画像からカード番号と蓋の座標を読み取り、一覧から作った候補と照合する。
// 人が確認すべきカードを、理由とともに data/work/review.json に書き出す。
// 切り出した画像は data/work/crops に保存し、読み取りの失敗を目で確かめられるようにする。
//
//	go run ./cmd/ocrcheck -list data/raw/gkp-list-YYYYMMDD.html
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"log"
	"math"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aki05162525/manhole-card-map/internal/cardimg"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

type result struct {
	Index     int          `json:"index"`
	City      string       `json:"city"`
	Image     string       `json:"image"`
	Label     bool         `json:"label"` // 数字の見本の作成に使った画像か
	Candidate string       `json:"candidate"`
	IDSource  gkp.IDSource `json:"idSource"`
	CodeRaw   string       `json:"codeRaw"`
	Code      string       `json:"code"`
	CodeMatch string       `json:"codeMatch"` // match / mismatch / unread / no-candidate
	Coord     string       `json:"coord"`
	Margin    float64      `json:"margin"`
	Lat       float64      `json:"lat,omitempty"`
	Lng       float64      `json:"lng,omitempty"`
	CoordErr  string       `json:"coordErr,omitempty"`
	Reasons   []string     `json:"reasons,omitempty"` // 人が確認すべき理由
}

// 人が確認すべき理由。
const (
	reasonCodeUnread   = "番号を読み取れない"
	reasonCodeMismatch = "番号が一覧の候補と一致しない"
	reasonNoCandidate  = "一覧から番号の候補を作れない"
	reasonCodeDup      = "読み取った番号がほかのカードと重複する"
	reasonCoordUnread  = "座標を読み取れない"
	reasonLowMargin    = "座標の数字の照合の確信度が低い"
	reasonFarFromPref  = "座標が同じ都道府県のカードから離れすぎている"
	reasonFarFromCity  = "座標が同じ自治体のカードから離れすぎている"
)

func main() {
	list := flag.String("list", "", "保存済みの一覧ページの HTML")
	imgDir := flag.String("images", "data/raw/images", "カード画像のディレクトリ")
	cropDir := flag.String("crops", "data/work/crops", "切り出した画像の保存先")
	out := flag.String("json", "data/work/ocr.json", "結果の出力先")
	reviewOut := flag.String("review", "data/work/review.json", "人が確認すべきカードの出力先")
	labelsPath := flag.String("labels", "data/ocr-labels.json", "座標の正解ラベル")
	minMargin := flag.Float64("min-margin", 0.02, "これより確信度の余裕が小さい座標を確認に回す")
	flag.Parse()

	labels, err := loadLabels(*labelsPath)
	if err != nil {
		log.Fatal(err)
	}
	tmpl, err := buildTemplates(labels, *imgDir)
	if err != nil {
		log.Fatal(err)
	}

	f, err := os.Open(*list)
	if err != nil {
		log.Fatal(err)
	}
	rows, err := gkp.ParseList(f)
	f.Close()
	if err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(*cropDir, 0o755); err != nil {
		log.Fatal(err)
	}

	var results []result
	missing := 0
	for _, r := range rows {
		name := strings.TrimRight(path.Base(strings.TrimSpace(r.ImageURL)), ".")
		if filepath.Ext(name) == "" {
			name += ".jpg"
		}
		img, err := load(filepath.Join(*imgDir, name))
		if os.IsNotExist(err) {
			missing++
			continue
		}
		if err != nil {
			log.Fatalf("%s: %v", name, err)
		}
		cand, src := gkp.CardID(r)
		_, isLabel := labels[name]
		res := result{Index: r.Index, City: strings.Join(r.City, " "), Image: name, Label: isLabel, Candidate: cand, IDSource: src}
		base := strings.TrimSuffix(name, filepath.Ext(name))

		code := cardimg.Crop(img, cardimg.CodeRegion, 3)
		save(filepath.Join(*cropDir, base+"-code.png"), code)
		if res.CodeRaw, err = cardimg.Tesseract(code, 7, "0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"); err != nil {
			log.Fatal(err)
		}
		c, ok := cardimg.ParseCode(res.CodeRaw)
		res.Code = c
		switch {
		case !ok:
			res.CodeMatch = "unread"
		case cand == "":
			res.CodeMatch = "no-candidate"
		case c == cand:
			res.CodeMatch = "match"
		default:
			res.CodeMatch = "mismatch"
		}

		save(filepath.Join(*cropDir, base+"-coord.png"), cardimg.Crop(img, cardimg.CoordRegion, 2))
		if p, err := tmpl.ReadCoord(img); err != nil {
			res.CoordErr = err.Error()
		} else {
			res.Coord, res.Lat, res.Lng, res.Margin = p.Text, p.Lat, p.Lng, p.Margin
		}
		results = append(results, res)
	}

	flagForReview(results, *minMargin)
	report(results, missing, *minMargin)

	writeJSON(*out, results)
	var review []result
	for _, r := range results {
		if len(r.Reasons) > 0 {
			review = append(review, r)
		}
	}
	writeJSON(*reviewOut, review)
	fmt.Printf("\n結果: %s / 確認待ち: %s（%d 枚） / 切り出した画像: %s\n", *out, *reviewOut, len(review), *cropDir)
}

// flagForReview は、人が確認すべきカードに理由を付ける。
func flagForReview(results []result, minMargin float64) {
	codes := map[string]int{}
	for _, r := range results {
		if r.Code != "" {
			codes[r.Code]++
		}
	}
	for i := range results {
		r := &results[i]
		switch r.CodeMatch {
		case "unread":
			r.Reasons = append(r.Reasons, reasonCodeUnread)
		case "mismatch":
			r.Reasons = append(r.Reasons, reasonCodeMismatch)
		case "no-candidate":
			r.Reasons = append(r.Reasons, reasonNoCandidate)
		}
		if r.Code != "" && codes[r.Code] > 1 {
			r.Reasons = append(r.Reasons, reasonCodeDup)
		}
		if r.CoordErr != "" {
			r.Reasons = append(r.Reasons, reasonCoordUnread)
		} else if r.Margin < minMargin {
			r.Reasons = append(r.Reasons, reasonLowMargin)
		}
	}
	flagFar(results, func(code string) string { return code[:2] }, 0, reasonFarFromPref, func(key string) float64 {
		if key == "01" {
			return 400 // 北海道は広い
		}
		return 150
	})
	flagFar(results, func(code string) string { return code[:6] }, 3, reasonFarFromCity, func(string) float64 { return 30 })
}

// flagFar は、番号の先頭（都道府県や自治体のコード）が同じカードの座標の中央値から、
// limit km 以上離れたカードに理由を付ける。中央値を使うので、1枚の誤読に引きずられにくい。
// 全国規模の団体（コード 00）は対象外にする。
func flagFar(results []result, key func(string) string, minCards int, reason string, limit func(string) float64) {
	groups := map[string][]int{}
	for i, r := range results {
		code := r.Code
		if code == "" {
			code = r.Candidate
		}
		if r.CoordErr != "" || len(code) < 6 || strings.HasPrefix(code, "00") {
			continue
		}
		groups[key(code)] = append(groups[key(code)], i)
	}
	for k, idx := range groups {
		if len(idx) < max(minCards, 2) {
			continue
		}
		var lats, lngs []float64
		for _, i := range idx {
			lats, lngs = append(lats, results[i].Lat), append(lngs, results[i].Lng)
		}
		mLat, mLng := median(lats), median(lngs)
		for _, i := range idx {
			if distanceKm(results[i].Lat, results[i].Lng, mLat, mLng) >= limit(k) {
				results[i].Reasons = append(results[i].Reasons, reason)
			}
		}
	}
}

func report(results []result, missing int, minMargin float64) {
	fmt.Printf("対象の画像: %d（未取得のため対象外: %d）\n", len(results), missing)

	count := func(pred func(result) bool) (label, other int) {
		for _, r := range results {
			if pred(r) {
				if r.Label {
					label++
				} else {
					other++
				}
			}
		}
		return
	}
	line := func(name string, pred func(result) bool) {
		l, o := count(pred)
		fmt.Printf("  %-28s %5d （見本に使った画像 %d / それ以外 %d）\n", name, l+o, l, o)
	}
	has := func(reason string) func(result) bool {
		return func(r result) bool {
			for _, x := range r.Reasons {
				if x == reason {
					return true
				}
			}
			return false
		}
	}

	fmt.Println("\n== カード番号")
	line("候補と一致", func(r result) bool { return r.CodeMatch == "match" })
	line("候補なしで印字から読めた", func(r result) bool { return r.CodeMatch == "no-candidate" })
	line("候補と不一致", func(r result) bool { return r.CodeMatch == "mismatch" })
	line("読み取れず", func(r result) bool { return r.CodeMatch == "unread" })
	line("読み取った番号の重複", has(reasonCodeDup))

	fmt.Println("\n== 蓋の座標")
	line("読み取れた", func(r result) bool { return r.CoordErr == "" })
	line("読み取れず", func(r result) bool { return r.CoordErr != "" })
	line(fmt.Sprintf("確信度が低い（余裕 < %.3f）", minMargin), has(reasonLowMargin))
	line("同じ都道府県から離れすぎ", has(reasonFarFromPref))
	line("同じ自治体から離れすぎ", has(reasonFarFromCity))

	var margins []float64
	for _, r := range results {
		if r.CoordErr == "" && !r.Label {
			margins = append(margins, r.Margin)
		}
	}
	sort.Float64s(margins)
	if n := len(margins); n > 0 {
		fmt.Printf("\n確信度の余裕の分布（見本以外 %d 枚）: 最小 %.3f / 1%% %.3f / 5%% %.3f / 中央値 %.3f\n",
			n, margins[0], margins[n/100], margins[n/20], margins[n/2])
	}

	fmt.Println("\n== 確認待ち（理由ごと、1枚に複数の理由がありうる）")
	byReason := map[string][]result{}
	for _, r := range results {
		for _, x := range r.Reasons {
			byReason[x] = append(byReason[x], r)
		}
	}
	for _, reason := range []string{reasonCodeUnread, reasonCodeMismatch, reasonNoCandidate, reasonCodeDup,
		reasonCoordUnread, reasonLowMargin, reasonFarFromPref, reasonFarFromCity} {
		rs := byReason[reason]
		if len(rs) == 0 {
			continue
		}
		fmt.Printf("[%s] %d 枚\n", reason, len(rs))
		for i, r := range rs {
			if i >= 8 {
				fmt.Printf("  …ほか %d 枚\n", len(rs)-i)
				break
			}
			fmt.Printf("  - %s %s 候補=%q 番号=%q 座標=%q 余裕=%.3f %s\n", r.Image, r.City, r.Candidate, r.Code, r.Coord, r.Margin, r.CoordErr)
		}
	}
}

func loadLabels(p string) (map[string]string, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var labels struct {
		Coords map[string]string `json:"coords"`
	}
	if err := json.Unmarshal(b, &labels); err != nil {
		return nil, err
	}
	return labels.Coords, nil
}

// buildTemplates は正解ラベルの付いた画像から数字の見本を作る。
func buildTemplates(labels map[string]string, imgDir string) (cardimg.Templates, error) {
	samples := map[image.Image]string{}
	for name, text := range labels {
		img, err := load(filepath.Join(imgDir, name))
		if err != nil {
			return cardimg.Templates{}, fmt.Errorf("見本の画像 %s: %w", name, err)
		}
		samples[img] = text
	}
	return cardimg.BuildTemplates(samples)
}

func median(xs []float64) float64 {
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	n := len(s)
	if n%2 == 1 {
		return s[n/2]
	}
	return (s[n/2-1] + s[n/2]) / 2
}

// distanceKm は2点間の大円距離（km）。
func distanceKm(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371.0
	rad := math.Pi / 180
	dLat, dLng := (lat2-lat1)*rad, (lng2-lng1)*rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * r * math.Asin(math.Sqrt(a))
}

func load(p string) (image.Image, error) {
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	return img, err
}

func save(p string, g *image.Gray) {
	f, err := os.Create(p)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()
	if err := png.Encode(f, g); err != nil {
		log.Fatal(err)
	}
}

func writeJSON(p string, v any) {
	b, _ := json.MarshalIndent(v, "", "  ")
	if err := os.WriteFile(p, b, 0o644); err != nil {
		log.Fatal(err)
	}
}
