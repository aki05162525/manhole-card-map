// builddata は保存済みの検証結果から、画像を含まない静的配布データを作る。
package main

import (
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

type Coordinate struct {
	Status string   `json:"status"`
	Lat    *float64 `json:"lat,omitempty"`
	Lng    *float64 `json:"lng,omitempty"`
	Source string   `json:"source"`
	Reason string   `json:"reason,omitempty"`
	Level  string   `json:"level,omitempty"`
	Review string   `json:"review"`
}
type Card struct {
	SourceStock  []string        `json:"-"`
	ID           string          `json:"id"`
	City         string          `json:"city"`
	Pref         string          `json:"pref"`
	Series       string          `json:"series"`
	Issued       string          `json:"issued"`
	Status       string          `json:"status"`
	Lid          Coordinate      `json:"lid"`
	PlaceText    []string        `json:"placeText"`
	Hours        []string        `json:"hours"`
	Links        []string        `json:"links"`
	Acquired     string          `json:"acquired"`
	Override     json.RawMessage `json:"override,omitempty"`
	Municipality json.RawMessage `json:"municipality"`
}
type Place struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Address    string     `json:"address"`
	Phone      string     `json:"phone"`
	Coordinate Coordinate `json:"coordinate"`
	Evidence   *Evidence  `json:"evidence,omitempty"`
}
type Relation struct {
	ReviewUntil     string    `json:"reviewUntil,omitempty"`
	Hours           []string  `json:"hours,omitempty"`
	Status          string    `json:"status,omitempty"`
	ValidFrom       string    `json:"validFrom,omitempty"`
	ValidTo         string    `json:"validTo,omitempty"`
	Review          string    `json:"review,omitempty"`
	Evidence        *Evidence `json:"evidence,omitempty"`
	CardID          string    `json:"cardId"`
	PlaceID         string    `json:"placeId"`
	Condition       string    `json:"condition"`
	Raw             []string  `json:"raw"`
	PeriodRaw       string    `json:"periodRaw"`
	AlternativeRaw  string    `json:"alternativeRaw"`
	AlternativeTo   *string   `json:"alternativeTo"`
	Interpretation  string    `json:"interpretation"`
	AddressBorrowed bool      `json:"addressBorrowed"`
}
type Pin struct {
	ID        string   `json:"id"`
	CardIDs   []string `json:"cardIds"`
	Kind      string   `json:"kind"`
	Status    string   `json:"status"`
	Lat       float64  `json:"lat"`
	Lng       float64  `json:"lng"`
	Reference bool     `json:"reference"`
}
type Data struct {
	EvaluatedAt string     `json:"evaluatedAt,omitempty"`
	Schema      int        `json:"schema"`
	Updated     string     `json:"updated"`
	Cards       []Card     `json:"cards"`
	Places      []Place    `json:"places"`
	Relations   []Relation `json:"relations"`
	Pins        []Pin      `json:"pins"`
}
type Check struct {
	Kind             string   `json:"kind"`
	Index            int      `json:"index"`
	Image            string   `json:"image"`
	Code             string   `json:"code"`
	City             string   `json:"city"`
	Lat              *float64 `json:"lat"`
	Lng              *float64 `json:"lng"`
	CoordinateSource string   `json:"coordinateSource"`
	CoordinateLevel  string   `json:"coordinateLevel"`
	OverrideReviewer string   `json:"overrideReviewer"`
	Source           *struct {
		Place    int  `json:"place"`
		Borrowed bool `json:"borrowed"`
	} `json:"source"`
	ByName struct {
		Status string `json:"status"`
	} `json:"byName"`
	ByCode struct {
		Status string `json:"status"`
	} `json:"byCode"`
}

func read(p string, v any) { b, e := os.ReadFile(p); must(e); must(json.Unmarshal(b, v)) }
func must(e error) {
	if e != nil {
		log.Fatal(e)
	}
}
func hash(b []byte) string { return fmt.Sprintf("%x", sha256.Sum256(b)) }
func write(p string, v any) string {
	b, e := json.Marshal(v)
	must(e)
	must(os.WriteFile(p, b, 0644))
	return hash(b)
}

// 座標の段階を許可リストで扱い、未知の段階を暗黙に通さない。
func placeCoordinate(c Check) Coordinate {
	p := Coordinate{Status: "unconfirmed", Source: c.CoordinateSource, Level: c.CoordinateLevel, Review: "人による施設位置の確認は未実施"}
	switch {
	case c.Source == nil || c.Source.Borrowed:
		p.Reason = "借用住所"
	case c.ByName.Status != "一致":
		p.Reason = "自治体照合が未解決"
	case c.Lat == nil || c.Lng == nil:
		p.Reason = "座標なし"
	case c.CoordinateLevel != "residential_detail" && c.CoordinateLevel != "residential_block" && c.CoordinateLevel != "parcel":
		p.Reason = "施設を示すには粗い座標"
	default:
		p.Status = "candidate"
		p.Lat = c.Lat
		p.Lng = c.Lng
		p.Reason = "試作の参考位置。公開用の確定位置ではない"
	}
	return p
}

var beforeRE = regexp.MustCompile(`配布(?:開始)?前|配布開始予定|配布予定`)

func distribution(r gkp.Row, asOf time.Time) string {
	text := strings.Join(append(append(append([]string{}, r.Place...), r.Hours...), r.Stock...), "\n")
	ended := strings.Contains(text, "配布終了") || strings.Contains(text, "配布を終了")
	suspended := gkp.CardStatus(r) == gkp.StatusSuspended
	if ended && (strings.Contains(text, "一時中止") || strings.Contains(text, "配布再開")) {
		return "unknown"
	}
	if ended {
		if len(gkp.ParsePlaces(r.Place).Places) > 0 && strings.TrimSpace(text) != "配布終了" && strings.TrimSpace(text) != "配布を終了" {
			return "unknown"
		}
		return "ended"
	}
	if suspended {
		return "suspended"
	}
	if beforeRE.MatchString(text) {
		return "upcoming"
	}
	issued, e := time.Parse("2006/01/02", r.Issued)
	if e == nil && issued.After(asOf) {
		return "upcoming"
	}
	if len(r.Place) == 0 {
		return "unknown"
	}
	return "active"
}
func main() {
	list := flag.String("list", "data/raw/gkp-list-20261021.html", "保存済み一覧")
	checks := flag.String("checks", "data/work/municheck.json", "自治体照合結果。入力 SHA-256 も検証する")
	out := flag.String("out", "web/public/data", "出力先")
	date := flag.String("date", "2026-10-21", "一覧の取得日。配布開始前判定の基準日")
	ledgerPath := flag.String("places", "data/overrides/places.json", "根拠付き配布施設台帳。空文字で無効化")
	evaluationDate := flag.String("as-of", "", "配布条件の適用基準日。省略時は一覧取得日")
	references := flag.Bool("reference-places", false, "候補の配布場所を試作の参考ピンに含める（公開禁止）")
	flag.Parse()
	asOf, e := time.Parse("2006-01-02", *date)
	must(e)
	var report struct {
		Inputs  map[string]string `json:"inputSHA256"`
		Results []json.RawMessage `json:"results"`
	}
	read(*checks, &report)
	for _, p := range []string{*list, "data/work/ocr.json", "data/overrides/cards.json", "data/work/geocoded-c.json", "data/work/addresses-sources.json"} {
		b, e := os.ReadFile(p)
		must(e)
		if report.Inputs[p] != hash(b) {
			log.Fatalf("照合結果の入力が変わっている。municheck を再実行する: %s", p)
		}
	}
	var ovs struct {
		Cards []json.RawMessage `json:"cards"`
	}
	read("data/overrides/cards.json", &ovs)
	overrides := map[string]json.RawMessage{}
	for _, b := range ovs.Cards {
		var o struct{ Image string }
		must(json.Unmarshal(b, &o))
		overrides[o.Image] = b
	}
	lids := map[int]Check{}
	pcs := map[string]Check{}
	for _, b := range report.Results {
		var c Check
		must(json.Unmarshal(b, &c))
		if c.Kind == "lid" {
			lids[c.Index] = c
		} else if c.Source != nil {
			pcs[fmt.Sprintf("%d/%d", c.Index, c.Source.Place)] = c
		}
	}
	f, e := os.Open(*list)
	must(e)
	rows, e := gkp.ParseList(f)
	f.Close()
	must(e)
	d := Data{Schema: 1, Updated: *date, Cards: []Card{}, Places: []Place{}, Relations: []Relation{}, Pins: []Pin{}}
	ids := map[string]bool{}
	places := map[string]int{}
	for _, r := range rows {
		c, ok := lids[r.Index]
		if !ok || c.Code == "" {
			log.Fatalf("番号のない行: %d", r.Index)
		}
		if ids[c.Code] {
			log.Fatalf("番号の重複: %s", c.Code)
		}
		ids[c.Code] = true
		co := Coordinate{Status: "unconfirmed", Source: c.CoordinateSource, Reason: "印字座標が未確定", Review: c.OverrideReviewer}
		if c.Lat != nil && c.Lng != nil {
			co.Status = "confirmed"
			co.Lat = c.Lat
			co.Lng = c.Lng
			co.Reason = "印字の読み取りを採用。現地位置の保証ではない"
			if co.Review == "" {
				co.Review = "OCR 自動照合"
			}
		}
		if c.ByName.Status == "不一致" {
			co.Status = "unconfirmed"
			co.Reason = "自治体不一致の原因未確定"
		}
		status := distribution(r, asOf)
		// 照合の要約だけを公開データへ渡し、画像のパスは含めない。
		summary, _ := json.Marshal(map[string]string{"byCode": c.ByCode.Status, "byName": c.ByName.Status})
		card := Card{SourceStock: r.Stock, ID: c.Code, City: c.City, Pref: gkp.PrefName(r), Series: r.Dan, Issued: r.Issued, Status: status, Lid: co, PlaceText: r.Place, Hours: r.Hours, Links: r.Links, Acquired: *date, Override: overrides[c.Image], Municipality: summary}
		d.Cards = append(d.Cards, card)
		if co.Status == "confirmed" {
			d.Pins = append(d.Pins, Pin{ID: "lid:" + c.Code, CardIDs: []string{c.Code}, Kind: "lid", Status: status, Lat: *co.Lat, Lng: *co.Lng})
		}
		parsed := gkp.ParsePlaces(r.Place)
		for i, p := range parsed.Places {
			pc := Coordinate{Status: "unconfirmed", Source: "保存済み一覧", Reason: "今回の座標取得対象外または住所なし", Review: "未確認"}
			if check, ok := pcs[fmt.Sprintf("%d/%d", r.Index, i)]; ok {
				pc = placeCoordinate(check)
			}
			// 借用と直接記載は別の出どころとして保持する。座標の品質は ID に含めない。
			key := strings.Join([]string{gkp.PrefName(r), p.Name, p.Address, p.Phone, fmt.Sprint(p.AddressFrom != nil)}, "\x00")
			pid := "place:" + hash([]byte(key))[:20]
			if _, ok := places[pid]; !ok {
				places[pid] = len(d.Places)
				d.Places = append(d.Places, Place{ID: pid, Name: p.Name, Address: p.Address, Phone: p.Phone, Coordinate: pc})
			} else if old := d.Places[places[pid]].Coordinate; old.Status != pc.Status || (old.Lat != nil && pc.Lat != nil && (*old.Lat != *pc.Lat || *old.Lng != *pc.Lng)) {
				d.Places[places[pid]].Coordinate = Coordinate{Status: "unconfirmed", Source: "複数の出どころ", Reason: "同じ場所の座標候補が一致しない", Review: "未確認"}
			}
			raw := strings.Join(r.Place, "\n")
			period, alternative := "", ""
			if strings.Contains(raw, "から") && (strings.Contains(raw, "まで") || strings.Contains(raw, "変更")) {
				period = raw
			}
			if strings.Contains(raw, "休館") || strings.Contains(raw, "代わり") {
				alternative = raw
			}
			d.Relations = append(d.Relations, Relation{CardID: c.Code, PlaceID: pid, Condition: p.Condition, Raw: r.Place, PeriodRaw: period, AlternativeRaw: alternative, Interpretation: "条件は原文を参照。期間と代替先の構造化は未確認", AddressBorrowed: p.AddressFrom != nil})
		}
	}
	ledger := PlaceLedger{Schema: 1}
	if *ledgerPath != "" {
		raw, err := os.ReadFile(*ledgerPath)
		must(err)
		must(decodeLedger(raw, &ledger))
		report.Inputs[*ledgerPath] = hash(raw)
	}
	evaluation := asOf
	if *evaluationDate != "" {
		evaluation, e = time.Parse("2006-01-02", *evaluationDate)
		must(e)
	}
	d.EvaluatedAt = evaluation.Format("2006-01-02")
	must(applyPlaceLedger(&d, ledger, evaluation))
	appendPlacePins(&d, *references)

	sort.Slice(d.Places, func(i, j int) bool { return d.Places[i].ID < d.Places[j].ID })
	must(os.MkdirAll(*out, 0755))
	write(filepath.Join(*out, "quality.json"), qualityReport(d))
	// full は比較用。split の起動ファイルには詳細を含めない。
	full := write(filepath.Join(*out, "full.json"), d)
	detail := d
	detail.Pins = nil
	details := write(filepath.Join(*out, "details.json"), detail)
	boot := write(filepath.Join(*out, "pins.json"), map[string]any{"schema": 1, "updated": *date, "pins": d.Pins, "detailsSHA256": details})
	write(filepath.Join(*out, "manifest.json"), map[string]any{"schema": 1, "updated": *date, "files": map[string]string{"full.json": full, "details.json": details, "pins.json": boot}, "inputs": report.Inputs, "referencePlaces": *references, "evaluatedAt": d.EvaluatedAt})
	counts := map[string]int{}
	for _, p := range d.Pins {
		counts[p.Kind]++
	}
	fmt.Printf("カード %d、場所 %d、対応 %d、ピン %v\n", len(d.Cards), len(d.Places), len(d.Relations), counts)
}
