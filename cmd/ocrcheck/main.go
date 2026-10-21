// ocrcheck は、取得済みのカード画像からカード番号と蓋の座標を読み取り、一覧から作った候補と照合する。
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
}

func main() {
	list := flag.String("list", "", "保存済みの一覧ページの HTML")
	imgDir := flag.String("images", "data/raw/images", "カード画像のディレクトリ")
	cropDir := flag.String("crops", "data/work/crops", "切り出した画像の保存先")
	out := flag.String("json", "data/work/ocr.json", "結果の出力先")
	labels := flag.String("labels", "data/ocr-labels.json", "座標の正解ラベル")
	flag.Parse()

	tmpl, err := buildTemplates(*labels, *imgDir)
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
	for _, r := range rows {
		name := strings.TrimRight(path.Base(strings.TrimSpace(r.ImageURL)), ".")
		if filepath.Ext(name) == "" {
			name += ".jpg"
		}
		img, err := load(filepath.Join(*imgDir, name))
		if os.IsNotExist(err) {
			continue // 未取得の画像は対象外
		}
		if err != nil {
			log.Fatalf("%s: %v", name, err)
		}
		cand, src := gkp.CardID(r)
		res := result{Index: r.Index, City: strings.Join(r.City, " "), Image: name, Candidate: cand, IDSource: src}
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

	report(results)
	b, _ := json.MarshalIndent(results, "", "  ")
	if err := os.WriteFile(*out, b, 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Println("\n結果:", *out, "/ 切り出した画像:", *cropDir)
}

func report(results []result) {
	fmt.Println("対象の画像:", len(results))
	byMatch := map[string][]result{}
	coordOK := 0
	for _, r := range results {
		byMatch[r.CodeMatch] = append(byMatch[r.CodeMatch], r)
		if r.CoordErr == "" {
			coordOK++
		}
	}
	fmt.Printf("\n== カード番号\n一致: %d / 不一致: %d / 読み取れず: %d / 候補なし: %d\n",
		len(byMatch["match"]), len(byMatch["mismatch"]), len(byMatch["unread"]), len(byMatch["no-candidate"]))
	for _, k := range []string{"mismatch", "unread", "no-candidate"} {
		for _, r := range byMatch[k] {
			fmt.Printf("  [%s] %s %s 候補=%q 印字=%q (raw %q)\n", k, r.Image, r.City, r.Candidate, r.Code, r.CodeRaw)
		}
	}
	fmt.Printf("\n== 蓋の座標\n読み取れた: %d / 読み取れず: %d\n", coordOK, len(results)-coordOK)
	var margins []float64
	for _, r := range results {
		if r.CoordErr == "" {
			margins = append(margins, r.Margin)
		}
	}
	sort.Float64s(margins)
	if len(margins) > 0 {
		fmt.Printf("数字の紛らわしさの余裕（小さいほど紛らわしい）: 最小 %.3f / 中央値 %.3f\n", margins[0], margins[len(margins)/2])
	}
	for _, r := range results {
		if r.CoordErr != "" {
			fmt.Printf("  %s %s: %s\n", r.Image, r.City, strings.ReplaceAll(r.CoordErr, "\n", " / "))
		}
	}
}

// buildTemplates は正解ラベルの付いた画像から数字の見本を作る。
func buildTemplates(labelsPath, imgDir string) (cardimg.Templates, error) {
	b, err := os.ReadFile(labelsPath)
	if err != nil {
		return cardimg.Templates{}, err
	}
	var labels struct {
		Coords map[string]string `json:"coords"`
	}
	if err := json.Unmarshal(b, &labels); err != nil {
		return cardimg.Templates{}, err
	}
	samples := map[image.Image]string{}
	for name, text := range labels.Coords {
		img, err := load(filepath.Join(imgDir, name))
		if err != nil {
			return cardimg.Templates{}, fmt.Errorf("見本の画像 %s: %w", name, err)
		}
		samples[img] = text
	}
	return cardimg.BuildTemplates(samples)
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
