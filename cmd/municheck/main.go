// municheck は蓋と配布場所の座標を N03 行政区域と照合する。元データや上書き記録は変更しない。
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"github.com/aki05162525/manhole-card-map/internal/municipality"
	"golang.org/x/text/unicode/norm"
)

type card struct {
	Index int      `json:"index"`
	City  string   `json:"city"`
	Image string   `json:"image"`
	Code  string   `json:"code"`
	Coord string   `json:"coord"`
	Lat   *float64 `json:"lat"`
	Lng   *float64 `json:"lng"`
}

type override struct {
	Image    string
	ID       string
	IDStatus string
	GKP      struct{ City string }
	Coord    struct {
		Printed, Status string
		Lat, Lng        *float64
	}
	OCR            struct{ Reasons []string }
	Reviewer, Note string
}

type source struct {
	Index     int    `json:"index"`
	City      string `json:"city"`
	Place     int    `json:"place"`
	Name      string `json:"name"`
	Original  string `json:"original"`
	Borrowed  bool   `json:"borrowed"`
	Condition string `json:"condition,omitempty"`
}

type geocoded struct {
	Query  struct{ Input string }
	Result struct {
		Lat   *float64 `json:"lat"`
		Lon   *float64 `json:"lon"`
		Level string   `json:"coordinate_level"`
	}
}

type target struct {
	Label string   `json:"label"`
	Scope string   `json:"scope"`
	Codes []string `json:"codes"`
}

type check struct {
	Target    target   `json:"target"`
	Status    string   `json:"status"`
	Reason    string   `json:"reason,omitempty"`
	BoundaryM *float64 `json:"boundaryM"`
}

type result struct {
	Kind             string              `json:"kind"`
	Index            int                 `json:"index"`
	Image            string              `json:"image"`
	Code             string              `json:"code"`
	City             string              `json:"city"`
	Pref             string              `json:"pref"`
	Lat              *float64            `json:"lat"`
	Lng              *float64            `json:"lng"`
	Printed          string              `json:"printed,omitempty"`
	CoordinateSource string              `json:"coordinateSource"`
	IDSource         string              `json:"idSource"`
	OverrideReviewer string              `json:"overrideReviewer,omitempty"`
	Query            string              `json:"query,omitempty"`
	Level            string              `json:"coordinateLevel,omitempty"`
	Source           *source             `json:"source,omitempty"`
	GKPPlace         []string            `json:"gkpPlace"`
	Actual           []municipality.Area `json:"actual"`
	Nearest          municipality.Area   `json:"nearest"`
	NearestBoundaryM *float64            `json:"nearestBoundaryM"`
	ByCode           check               `json:"byCode"`
	ByName           check               `json:"byName"`
	TargetConflict   bool                `json:"targetConflict"`
	FarPreviously    bool                `json:"farPreviously"`
	Review           bool                `json:"review"`
	Finding          string              `json:"finding"`
	Evidence         string              `json:"evidence"`
	Reviewer         string              `json:"reviewer"`
}

type report struct {
	BoundaryFile   string                    `json:"boundaryFile"`
	BoundarySHA256 string                    `json:"boundarySHA256"`
	ThresholdM     float64                   `json:"thresholdM"`
	Inputs         map[string]string         `json:"inputSHA256"`
	Summary        map[string]map[string]int `json:"summary"`
	Results        []result                  `json:"results"`
}

func main() {
	boundary := flag.String("boundary", "data/raw/N03-20260101_GML.zip", "N03 全国版 ZIP")
	member := flag.String("member", "N03-20260101.geojson", "ZIP 中の GeoJSON")
	ocrPath := flag.String("ocr", "data/work/ocr.json", "OCR の結果")
	overridesPath := flag.String("overrides", "data/overrides/cards.json", "優先する確認記録")
	geoPath := flag.String("geocoded", "data/work/geocoded-c.json", "data-c による座標")
	sourcesPath := flag.String("sources", "data/work/addresses-sources.json", "住所の出どころ")
	listPath := flag.String("list", "data/raw/gkp-list-20261021.html", "保存した一覧 HTML")
	threshold := flag.Float64("near", 50, "境界付近とする距離（m）")
	out := flag.String("out", "data/work/municheck.json", "判定結果")
	htmlOut := flag.String("html", "data/work/municipality-review.html", "確認ページ")
	findingsPath := flag.String("findings", "", "AI が画像と一覧を確認した所見 JSON（任意）")
	flag.Parse()
	if math.IsNaN(*threshold) || math.IsInf(*threshold, 0) || *threshold < 0 {
		log.Fatal("near は0以上の有限値を指定する")
	}
	d, err := municipality.LoadZIP(*boundary, *member)
	must(err)
	log.Printf("境界: %d 自治体、%d 多角形", len(d.Areas()), d.PolygonCount())
	var cards []card
	must(readJSON(*ocrPath, &cards))
	var overrides struct{ Cards []override }
	must(readJSON(*overridesPath, &overrides))
	ov := map[string]override{}
	for _, v := range overrides.Cards {
		if _, ok := ov[v.Image]; ok {
			log.Fatalf("上書き画像の重複: %s", v.Image)
		}
		ov[v.Image] = v
	}
	var geo []geocoded
	must(readJSON(*geoPath, &geo))
	var sources map[string][]source
	must(readJSON(*sourcesPath, &sources))
	f, err := os.Open(*listPath)
	must(err)
	rows, err := gkp.ParseList(f)
	f.Close()
	must(err)
	rowByID := map[int]gkp.Row{}
	for _, r := range rows {
		rowByID[r.Index] = r
	}
	res := report{BoundaryFile: *boundary, BoundarySHA256: hashFile(*boundary), ThresholdM: *threshold, Inputs: map[string]string{}, Summary: map[string]map[string]int{}}
	for _, p := range []string{*ocrPath, *overridesPath, *geoPath, *sourcesPath, *listPath} {
		res.Inputs[p] = hashFile(p)
	}
	byIndex := map[int]result{}
	for _, c := range cards {
		row, ok := rowByID[c.Index]
		if !ok {
			log.Fatalf("一覧にない行: %d", c.Index)
		}
		if _, ok := byIndex[c.Index]; ok {
			log.Fatalf("OCR 行の重複: %d", c.Index)
		}
		r := result{Kind: "lid", Index: c.Index, Image: c.Image, Code: c.Code, City: strings.Join(row.City, " "), Pref: gkp.PrefName(row), Lat: c.Lat, Lng: c.Lng, Printed: c.Coord, CoordinateSource: *ocrPath, IDSource: *ocrPath, GKPPlace: row.Place, Reviewer: "Codex（AI、自動照合）"}
		exclude := ""
		if v, ok := ov[c.Image]; ok {
			r.OverrideReviewer = v.Reviewer
			if v.IDStatus == "confirmed" {
				r.Code = v.ID
				r.IDSource = *overridesPath
			}
			if v.GKP.City != "" {
				r.City = v.GKP.City
			}
			r.Printed = v.Coord.Printed
			r.CoordinateSource = *overridesPath
			if v.Coord.Status == "confirmed" {
				r.Lat = v.Coord.Lat
				r.Lng = v.Coord.Lng
			} else {
				r.Lat = nil
				r.Lng = nil
				exclude = "上書き記録で座標未確定: " + v.Note
			}
			for _, reason := range v.OCR.Reasons {
				if strings.Contains(reason, "同じ自治体") {
					r.FarPreviously = true
				}
			}
		}
		r.ByCode.Target = codeTarget(d, r.Code)
		r.ByName.Target = nameTarget(d, r.Pref, r.City, r.Code)
		r.TargetConflict = disjoint(r.ByCode.Target.Codes, r.ByName.Target.Codes)
		byIndex[c.Index] = r
		evaluate(d, &r, *threshold, exclude)
		res.Results = append(res.Results, r)
	}
	seen := map[string]bool{}
	for _, g := range geo {
		if seen[g.Query.Input] {
			log.Fatalf("ジオコーディング住所の重複: %s", g.Query.Input)
		}
		seen[g.Query.Input] = true
		ss, ok := sources[g.Query.Input]
		if !ok {
			log.Fatalf("出どころのない住所: %s", g.Query.Input)
		}
		for _, s := range ss {
			r, ok := byIndex[s.Index]
			if !ok {
				log.Fatalf("OCR にない行: %d", s.Index)
			}
			r.Kind = "distribution"
			r.Lat = g.Result.Lat
			r.Lng = g.Result.Lon
			r.CoordinateSource = *geoPath
			r.Printed = ""
			r.Query = g.Query.Input
			r.Level = g.Result.Level
			r.Source = &s
			evaluate(d, &r, *threshold, "")
			res.Results = append(res.Results, r)
		}
	}
	if len(seen) != len(sources) {
		log.Fatal("住所の出どころとジオコーディング結果の集合が異なる")
	}
	if *findingsPath != "" {
		applyFindings(res.Results, *findingsPath)
		res.Inputs[*findingsPath] = hashFile(*findingsPath)
	}
	for _, r := range res.Results {
		for k, c := range map[string]check{"code": r.ByCode, "name": r.ByName} {
			key := r.Kind + "/" + k
			if res.Summary[key] == nil {
				res.Summary[key] = map[string]int{}
			}
			res.Summary[key][c.Status]++
		}
	}
	must(os.MkdirAll(filepath.Dir(*out), 0755))
	b, err := json.MarshalIndent(res, "", "  ")
	must(err)
	must(os.WriteFile(*out, b, 0644))
	must(writeReview(*htmlOut, res))
	b, _ = json.MarshalIndent(res.Summary, "", "  ")
	fmt.Println(string(b))
}

func evaluate(d *municipality.Dataset, r *result, threshold float64, exclude string) {
	if strings.HasPrefix(r.Code, "00-") {
		exclude = "全国を対象とする団体"
	}
	if r.Lat == nil || r.Lng == nil {
		if exclude == "" {
			exclude = "座標がない"
		}
	} else if !(municipality.Point{*r.Lng, *r.Lat}).Valid() {
		exclude = "座標が不正"
	}
	if exclude != "" {
		r.ByCode.Status = "対象外"
		r.ByName.Status = "対象外"
		r.ByCode.Reason = exclude
		r.ByName.Reason = exclude
		return
	}
	pt := municipality.Point{*r.Lng, *r.Lat}
	r.Actual = d.Locate(pt)
	v, a := d.Distance(pt, nil)
	r.Nearest = a
	r.NearestBoundaryM = finite(v)
	r.ByCode = classify(d, pt, r.Actual, r.ByCode.Target, threshold)
	r.ByName = classify(d, pt, r.Actual, r.ByName.Target, threshold)
	r.Review = r.ByCode.Status != "一致" || r.ByName.Status != "一致" || r.TargetConflict || r.FarPreviously || slices.Contains([]string{"city", "prefecture"}, r.Level)
	if r.Review {
		r.Finding = "原因不明"
		r.Evidence = "境界との自動照合のみ。画像と一覧による原因確認が必要"
		if r.ByCode.Status == "一致" && r.ByName.Status == "一致" {
			r.Finding = "自治体の範囲は一致（施設や蓋の位置は未確定）"
			r.Evidence = "粗い座標または以前の距離検査の対象。自治体内に入ることだけでは位置や住所借用の正しさを確認できない"
		}
	}
}

func classify(d *municipality.Dataset, p municipality.Point, actual []municipality.Area, t target, n float64) check {
	c := check{Target: t}
	codes := map[string]bool{}
	for _, k := range t.Codes {
		codes[k] = true
	}
	if len(codes) == 0 {
		c.Status = "判定不能"
		c.Reason = "比較先の自治体を特定できない"
		return c
	}
	v, _ := d.Distance(p, codes)
	c.BoundaryM = finite(v)
	if len(actual) == 0 {
		c.Status = "判定不能"
		c.Reason = "どの多角形にも入らない"
		return c
	}
	for _, a := range actual {
		if codes[a.Code] {
			c.Status = "一致"
			return c
		}
	}
	if v <= n {
		c.Status = "境界付近"
	} else {
		c.Status = "不一致"
	}
	return c
}

var cardPattern = regexp.MustCompile(`^(\d{2})-(\d{3})-[A-Z]+\d{3}$`)
var parentheses = regexp.MustCompile(`\([^)]*\)`)

func codeTarget(d *municipality.Dataset, code string) target {
	t := target{Label: code, Scope: "unresolved"}
	m := cardPattern.FindStringSubmatch(code)
	if m == nil {
		return t
	}
	key := m[1] + m[2]
	if m[1] == "00" {
		t.Scope = "national"
		return t
	}
	if m[2] == "000" {
		t.Scope = "prefecture"
		t.Codes = keys(d.PrefCodes(m[1]))
		return t
	}
	if key == "13100" {
		t.Scope = "tokyo23"
		for _, a := range d.Areas() {
			if a.Code >= "13101" && a.Code <= "13123" {
				t.Codes = append(t.Codes, a.Code)
			}
		}
		return t
	}
	for _, a := range d.Areas() {
		if a.Code == key {
			t.Label = a.Pref + a.City + a.Ward
			t.Scope = "municipality"
			t.Codes = []string{key}
			return t
		}
	}
	// 政令市のコードは、同じ市の最小区コードを10単位で切り下げた値と照合する。
	// 現行 N03 にある市名でまとめ、任意の未知コードを丸めて救済することはしない。
	groups := map[string][]municipality.Area{}
	for _, a := range d.Areas() {
		if a.Ward != "" {
			k := a.Pref + a.City
			groups[k] = append(groups[k], a)
		}
	}
	for name, as := range groups {
		minCode := 99999
		for _, a := range as {
			v, _ := strconv.Atoi(a.Code)
			minCode = min(minCode, v)
		}
		if fmt.Sprintf("%05d", minCode/10*10) == key {
			t.Label = name
			t.Scope = "city"
			for _, a := range as {
				t.Codes = append(t.Codes, a.Code)
			}
			sort.Strings(t.Codes)
			return t
		}
	}
	return t
}

func nameTarget(d *municipality.Dataset, pref, name, code string) target {
	t := target{Label: pref + " " + name, Scope: "unresolved"}
	if strings.HasPrefix(code, "00-") {
		t.Scope = "national"
		return t
	}
	plain := parentheses.ReplaceAllString(norm.NFKC.String(name), "")
	n := strings.Join(strings.Fields(plain), "")
	pref = norm.NFKC.String(pref)
	n = strings.TrimPrefix(n, pref)
	// 自治体名の後ろに別の団体名が併記される場合は、空白で区切られた先頭も照合する。
	first := ""
	if fields := strings.Fields(strings.TrimSpace(strings.TrimPrefix(plain, pref))); len(fields) > 1 {
		first = fields[0]
	}
	if n == "東京23区" || n == "23区" {
		return codeTarget(d, "13-100-A001")
	}
	for _, a := range d.Areas() {
		if a.Pref != pref {
			continue
		}
		if n == a.City || first == a.City || n == a.City+a.Ward || (a.Ward != "" && n == a.Ward) || n == a.County+a.City {
			t.Codes = append(t.Codes, a.Code)
		}
	}
	if len(t.Codes) > 0 {
		t.Scope = "municipality"
		if len(t.Codes) > 1 {
			t.Scope = "city"
		}
		return t
	}
	if n == "" || strings.Contains(name, "流域") || strings.Contains(name, "公社") || strings.Contains(name, "広域") {
		t.Scope = "prefecture"
		t.Codes = keys(d.Codes(pref, "", ""))
	}
	return t
}

func disjoint(a, b []string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	for _, s := range a {
		if slices.Contains(b, s) {
			return false
		}
	}
	return true
}
func keys(m map[string]bool) []string {
	s := make([]string, 0, len(m))
	for k := range m {
		s = append(s, k)
	}
	sort.Strings(s)
	return s
}
func finite(v float64) *float64 {
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return nil
	}
	return &v
}
func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
func readJSON(p string, v any) error {
	f, e := os.Open(p)
	if e != nil {
		return e
	}
	defer f.Close()
	return json.NewDecoder(f).Decode(v)
}
func hashFile(p string) string {
	f, e := os.Open(p)
	must(e)
	defer f.Close()
	h := sha256.New()
	_, e = io.Copy(h, f)
	must(e)
	return hex.EncodeToString(h.Sum(nil))
}
