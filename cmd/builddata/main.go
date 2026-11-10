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
	ReviewSourceHash string          `json:"reviewSourceHash,omitempty"`
	SourceStock      []string        `json:"-"`
	ID               string          `json:"id"`
	City             string          `json:"city"`
	Pref             string          `json:"pref"`
	Series           string          `json:"series"`
	Issued           string          `json:"issued"`
	Status           string          `json:"status"`
	Lid              Coordinate      `json:"lid"`
	PlaceText        []string        `json:"placeText"`
	Hours            []string        `json:"hours"`
	Links            []string        `json:"links"`
	Acquired         string          `json:"acquired"`
	Override         json.RawMessage `json:"override,omitempty"`
	Municipality     json.RawMessage `json:"municipality"`
}
type Place struct {
	LocationReview *LocationReview `json:"locationReview,omitempty"`
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Address        string          `json:"address"`
	Phone          string          `json:"phone"`
	Coordinate     Coordinate      `json:"coordinate"`
	Evidence       *Evidence       `json:"evidence,omitempty"`
}
type Relation struct {
	MaintenanceNotes []string        `json:"maintenanceNotes,omitempty"`
	Change           *RelationChange `json:"change,omitempty"`
	ReviewUntil      string          `json:"reviewUntil,omitempty"`
	Hours            []string        `json:"hours,omitempty"`
	Status           string          `json:"status,omitempty"`
	ValidFrom        string          `json:"validFrom,omitempty"`
	ValidTo          string          `json:"validTo,omitempty"`
	Review           string          `json:"review,omitempty"`
	Evidence         *Evidence       `json:"evidence,omitempty"`
	CardID           string          `json:"cardId"`
	PlaceID          string          `json:"placeId"`
	Condition        string          `json:"condition"`
	Raw              []string        `json:"raw"`
	PeriodRaw        string          `json:"periodRaw"`
	AlternativeRaw   string          `json:"alternativeRaw"`
	AlternativeTo    *string         `json:"alternativeTo"`
	Interpretation   string          `json:"interpretation"`
	AddressBorrowed  bool            `json:"addressBorrowed"`
}
type Pin struct {
	Pref      string   `json:"pref"`
	ID        string   `json:"id"`
	CardIDs   []string `json:"cardIds"`
	Kind      string   `json:"kind"`
	Status    string   `json:"status"`
	Lat       float64  `json:"lat"`
	Lng       float64  `json:"lng"`
	Reference bool     `json:"reference"`
}
type Data struct {
	CardAliases  map[string]string `json:"cardAliases"`
	ReviewSource string            `json:"reviewSource,omitempty"`
	EvaluatedAt  string            `json:"evaluatedAt,omitempty"`
	Schema       int               `json:"schema"`
	Updated      string            `json:"updated"`
	Cards        []Card            `json:"cards"`
	Places       []Place           `json:"places"`
	Relations    []Relation        `json:"relations"`
	Pins         []Pin             `json:"pins"`
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
	case !validGeographicCoordinate(*c.Lat, *c.Lng):
		p.Reason = "地理座標の範囲外または非有限値"
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

// lidCoordinate validates saved numeric checks independently of OCR's Japan-only
// misread filter. Missing checks remain unconfirmed; invalid numbers fail build.
func lidCoordinate(c Check) (Coordinate, error) {
	co := Coordinate{Status: "unconfirmed", Source: c.CoordinateSource, Reason: "印字座標が未確定", Review: c.OverrideReviewer}
	if c.Lat != nil && c.Lng != nil {
		if !validGeographicCoordinate(*c.Lat, *c.Lng) {
			return Coordinate{}, fmt.Errorf("invalid lid coordinate: %s", c.Code)
		}
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
	return co, nil
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

// placesInputKey identifies the generated ledger independently of its temporary location.
const placesInputKey = "assembled-places"

func main() {
	list := flag.String("list", "data/raw/gkp-list-20261021.html", "保存済み一覧")
	checks := flag.String("checks", "data/work/municheck.json", "自治体照合結果。入力 SHA-256 も検証する")
	out := flag.String("out", "web/public/data", "公開用出力先")
	internalOut := flag.String("internal-out", "data/work/internal-data", "監査用の完全な出力先（web外）")
	date := flag.String("date", "2026-10-21", "一覧の取得日。配布開始前判定の基準日")
	ledgerPath := flag.String("places", "data/overrides/places.json", "根拠付き配布施設台帳。空文字で無効化")
	reviewList := flag.String("review-list", "", "現一覧HTML。画像URLで照合し配布情報の変更を失効判定に反映。旧原文は保持")
	fragments := flag.String("place-fragments", "", "地域台帳のglob。衝突時は停止")
	mergedPath := flag.String("merged-places", "", "検証後の単一統合台帳出力")
	auditPath := flag.String("audit-out", "", "全国監査JSON/Markdownの出力prefix")
	evaluationDate := flag.String("as-of", "", "配布条件の適用基準日。省略時は一覧取得日")
	references := flag.Bool("reference-places", false, "候補の配布場所を試作の参考ピンに含める（公開禁止）")
	cardIDsPath := flag.String("card-ids", "data/card-ids.json", "Published card ID registry")
	updateCardIDs := flag.Bool("update-card-ids", false, "Add new generated IDs to the registry for review")
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
	latestHashes := map[string]string{}
	if *reviewList != "" {
		raw, err := os.ReadFile(*reviewList)
		must(err)
		latest, err := gkp.ParseList(strings.NewReader(string(raw)))
		must(err)
		latestHashes, e = reviewHashes(rows, latest)
		must(e)
		report.Inputs[*reviewList] = hash(raw)
	}
	d := Data{ReviewSource: *reviewList, Schema: 1, Updated: *date, Cards: []Card{}, Places: []Place{}, Relations: []Relation{}, Pins: []Pin{}}
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
		co, err := lidCoordinate(c)
		must(err)
		status := distribution(r, asOf)
		// 照合の要約だけを公開データへ渡し、画像のパスは含めない。
		summary, _ := json.Marshal(map[string]string{"byCode": c.ByCode.Status, "byName": c.ByName.Status})
		card := Card{ReviewSourceHash: latestHashes[r.ImageURL], SourceStock: r.Stock, ID: c.Code, City: c.City, Pref: gkp.PrefName(r), Series: r.Dan, Issued: r.Issued, Status: status, Lid: co, PlaceText: r.Place, Hours: r.Hours, Links: r.Links, Acquired: *date, Override: overrides[c.Image], Municipality: summary}
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
	var registry CardIDRegistry
	registryRaw, err := os.ReadFile(*cardIDsPath)
	must(err)
	must(json.Unmarshal(registryRaw, &registry))
	currentIDs := make([]string, 0, len(d.Cards))
	for _, card := range d.Cards {
		currentIDs = append(currentIDs, card.ID)
	}
	if *updateCardIDs {
		registry.add(currentIDs)
	}
	must(registry.validate(currentIDs))
	d.CardAliases = registry.Aliases
	if d.CardAliases == nil {
		d.CardAliases = map[string]string{}
	}
	report.Inputs[*cardIDsPath] = hash(registryRaw)
	ledger := PlaceLedger{Schema: 1}
	if *ledgerPath != "" {
		raw, err := os.ReadFile(*ledgerPath)
		must(err)
		must(decodeLedger(raw, &ledger))
		report.Inputs[placesInputKey] = hash(raw)
	}
	if *fragments != "" {
		paths, err := filepath.Glob(*fragments)
		must(err)
		if len(paths) == 0 {
			log.Fatal("place-fragments matched no files")
		}
		inputs := []PlaceLedger{ledger}
		for _, p := range paths {
			raw, err := os.ReadFile(p)
			must(err)
			var fragment PlaceLedger
			must(decodeLedger(raw, &fragment))
			inputs = append(inputs, fragment)
			report.Inputs[p] = hash(raw)
		}
		ledger, e = mergeLedgers(inputs)
		must(e)
	}
	evaluation := asOf
	if *evaluationDate != "" {
		evaluation, e = time.Parse("2006-01-02", *evaluationDate)
		must(e)
	}
	d.EvaluatedAt = evaluation.Format("2006-01-02")
	must(applyPlaceLedger(&d, ledger, evaluation))
	if *mergedPath != "" {
		write(*mergedPath, ledger)
	}
	if *auditPath != "" {
		a := nationalAudit(d)
		a.Inputs = report.Inputs
		must(writeNationalAudit(*auditPath, a))
	}
	appendPlacePins(&d, *references)
	must(assignPinPrefs(&d))

	if *updateCardIDs {
		updated, err := json.MarshalIndent(registry, "", "  ")
		must(err)
		updated = append(updated, '\n')
		must(os.WriteFile(*cardIDsPath, updated, 0644))
		report.Inputs[*cardIDsPath] = hash(updated)
	}
	sort.Slice(d.Places, func(i, j int) bool { return d.Places[i].ID < d.Places[j].ID })
	must(validateOutputDirectories(*out, *internalOut))
	must(os.MkdirAll(*out, 0755))
	must(os.MkdirAll(*internalOut, 0755))
	write(filepath.Join(*internalOut, "quality.json"), qualityReport(d))
	internalFull := write(filepath.Join(*internalOut, "full.json"), d)
	detail := d
	detail.Pins = nil
	internalDetails := write(filepath.Join(*internalOut, "details.json"), detail)
	internalPins := write(filepath.Join(*internalOut, "pins.json"), map[string]any{"schema": 1, "updated": *date, "pins": d.Pins, "detailsSHA256": internalDetails})
	write(filepath.Join(*internalOut, "manifest.json"), map[string]any{"schema": 1, "updated": *date, "files": map[string]string{"full.json": internalFull, "details.json": internalDetails, "pins.json": internalPins}, "inputs": report.Inputs, "referencePlaces": *references, "evaluatedAt": d.EvaluatedAt})
	// Remove the legacy report on regeneration, including previously compressed copies.
	for _, suffix := range []string{"", ".gz", ".br"} {
		err := os.Remove(filepath.Join(*out, "quality.json"+suffix))
		if err != nil && !os.IsNotExist(err) {
			must(err)
		}
	}
	public, err := publicData(d)
	must(err)
	full := write(filepath.Join(*out, "full.json"), public)
	pins := public.Pins
	public.Pins = nil
	details := write(filepath.Join(*out, "details.json"), public)
	boot := write(filepath.Join(*out, "pins.json"), PublicPins{1, *date, pins, details})
	write(filepath.Join(*out, "manifest.json"), PublicManifest{1, *date, map[string]string{"full.json": full, "details.json": details, "pins.json": boot}})
	counts := map[string]int{}
	for _, p := range d.Pins {
		counts[p.Kind]++
	}
	fmt.Printf("カード %d、場所 %d、対応 %d、ピン %v\n", len(d.Cards), len(d.Places), len(d.Relations), counts)
}
