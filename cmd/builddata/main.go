// builddata は保存済みの検証結果から静的配布データを作る。画像そのものは含めず、
// 許諾を得たカードにだけ KV の画像のパス（data/card-images.json）を足す。
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
	Image            *CardImage      `json:"image,omitempty"`
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
	HasLedgerRow     bool             `json:"-"`
	Applies          *Applies         `json:"applies,omitempty"`
	MaintenanceNotes []string         `json:"maintenanceNotes,omitempty"`
	Change           *RelationChange  `json:"change,omitempty"`
	ReviewUntil      string           `json:"reviewUntil,omitempty"`
	Upcoming         []UpcomingChange `json:"upcoming,omitempty"`
	Hours            []string         `json:"hours,omitempty"`
	Status           string           `json:"status,omitempty"`
	ValidFrom        string           `json:"validFrom,omitempty"`
	ValidTo          string           `json:"validTo,omitempty"`
	Review           string           `json:"review,omitempty"`
	Evidence         *Evidence        `json:"evidence,omitempty"`
	CardID           string           `json:"cardId"`
	PlaceID          string           `json:"placeId"`
	Condition        string           `json:"condition"`
	Raw              []string         `json:"raw"`
	PeriodRaw        string           `json:"periodRaw"`
	AlternativeRaw   string           `json:"alternativeRaw"`
	AlternativeTo    *string          `json:"alternativeTo"`
	Interpretation   string           `json:"interpretation"`
	AddressBorrowed  bool             `json:"addressBorrowed"`
}

// UpcomingChange is a verified later period of a relation: what it becomes from ValidFrom.
type UpcomingChange struct {
	Applies   *Applies `json:"applies,omitempty"`
	Hours     []string `json:"hours,omitempty"`
	Status    string   `json:"status"`
	ValidFrom string   `json:"validFrom"`
	ValidTo   string   `json:"validTo,omitempty"`
	Condition string   `json:"condition"`
}
type Pin struct {
	Pref    string   `json:"pref"`
	ID      string   `json:"id"`
	CardIDs []string `json:"cardIds"`
	Kind    string   `json:"kind"`
	Status  string   `json:"status"`
	Lat     float64  `json:"lat"`
	Lng     float64  `json:"lng"`
}
type Data struct {
	ExcludedRelations map[string]int    `json:"-"`
	CardAliases       map[string]string `json:"cardAliases"`
	ReviewSource      string            `json:"reviewSource,omitempty"`
	EvaluatedAt       string            `json:"evaluatedAt,omitempty"`
	Schema            int               `json:"schema"`
	Updated           string            `json:"updated"`
	Cards             []Card            `json:"cards"`
	Places            []Place           `json:"places"`
	Relations         []Relation        `json:"relations"`
	Pins              []Pin             `json:"pins"`
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

func read(p string, v any) error {
	b, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("%s: %w", p, err)
	}
	return nil
}
func hash(b []byte) string { return fmt.Sprintf("%x", sha256.Sum256(b)) }
func (batch *outputBatch) write(p string, v any) (string, error) {
	b, e := json.Marshal(v)
	if e != nil {
		return "", fmt.Errorf("%s: %w", p, e)
	}
	if err := batch.stage(p, b); err != nil {
		return "", err
	}
	return hash(b), nil
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

type buildOptions struct {
	list           string
	checks         string
	out            string
	internalOut    string
	date           string
	ledgerPath     string
	reviewList     string
	evaluationDate string
	cardIDsPath    string
	cardImagesPath string
	updateCardIDs  bool
}

func main() {
	var opts buildOptions
	flag.StringVar(&opts.list, "list", "data/raw/gkp-list-20261021.html", "保存済み一覧")
	flag.StringVar(&opts.checks, "checks", "data/work/municheck.json", "自治体照合結果。入力 SHA-256 も検証する")
	flag.StringVar(&opts.out, "out", "web/public/data", "公開用出力先")
	flag.StringVar(&opts.internalOut, "internal-out", "data/work/internal-data", "監査用の完全な出力先（web外）")
	flag.StringVar(&opts.date, "date", "2026-10-21", "一覧の取得日。配布開始前判定の基準日")
	flag.StringVar(&opts.ledgerPath, "places", "", "根拠付き配布施設台帳（tools/db/ledgerdb.py export-ledger の出力）。必須")
	flag.StringVar(&opts.reviewList, "review-list", "", "現一覧HTML。画像URLで照合し配布情報の変更を失効判定に反映。旧原文は保持")
	flag.StringVar(&opts.evaluationDate, "as-of", "", "配布条件の適用基準日。省略時は一覧取得日")
	flag.StringVar(&opts.cardIDsPath, "card-ids", "data/card-ids.json", "Published card ID registry")
	flag.StringVar(&opts.cardImagesPath, "card-images", "data/card-images.json", "自治体の許諾を得たカード画像の記録")
	flag.BoolVar(&opts.updateCardIDs, "update-card-ids", false, "Add new generated IDs to the registry for review")
	flag.Parse()
	if err := build(opts); err != nil {
		log.Fatal(err)
	}
}

func build(opts buildOptions) error {
	if opts.ledgerPath == "" {
		return fmt.Errorf("-places is required: pass the ledger exported from data/db")
	}
	asOf, e := time.Parse("2006-01-02", opts.date)
	if e != nil {
		return e
	}
	var report struct {
		Inputs  map[string]string `json:"inputSHA256"`
		Results []json.RawMessage `json:"results"`
	}
	if err := read(opts.checks, &report); err != nil {
		return err
	}
	for _, p := range []string{opts.list, "data/work/ocr.json", "data/overrides/cards.json", "data/work/geocoded-c.json", "data/work/addresses-sources.json"} {
		b, e := os.ReadFile(p)
		if e != nil {
			return e
		}
		if report.Inputs[p] != hash(b) {
			return fmt.Errorf("照合結果の入力が変わっている。municheck を再実行する: %s", p)
		}
	}
	var ovs struct {
		Cards []json.RawMessage `json:"cards"`
	}
	if err := read("data/overrides/cards.json", &ovs); err != nil {
		return err
	}
	overrides := map[string]json.RawMessage{}
	for _, b := range ovs.Cards {
		var o struct{ Image string }
		if err := json.Unmarshal(b, &o); err != nil {
			return fmt.Errorf("%s: %w", "data/overrides/cards.json", err)
		}
		overrides[o.Image] = b
	}
	lids := map[int]Check{}
	pcs := map[string]Check{}
	for _, b := range report.Results {
		var c Check
		if err := json.Unmarshal(b, &c); err != nil {
			return fmt.Errorf("%s: %w", opts.checks, err)
		}
		if c.Kind == "lid" {
			lids[c.Index] = c
		} else if c.Source != nil {
			pcs[fmt.Sprintf("%d/%d", c.Index, c.Source.Place)] = c
		}
	}
	f, e := os.Open(opts.list)
	if e != nil {
		return e
	}
	rows, e := gkp.ParseList(f)
	f.Close()
	if e != nil {
		return e
	}
	latestHashes := map[string]string{}
	if opts.reviewList != "" {
		raw, err := os.ReadFile(opts.reviewList)
		if err != nil {
			return err
		}
		latest, err := gkp.ParseList(strings.NewReader(string(raw)))
		if err != nil {
			return err
		}
		latestHashes, e = reviewHashes(rows, latest)
		if e != nil {
			return e
		}
		report.Inputs[opts.reviewList] = hash(raw)
	}
	d := Data{ReviewSource: opts.reviewList, Schema: 1, Updated: opts.date, Cards: []Card{}, Places: []Place{}, Relations: []Relation{}, Pins: []Pin{}}
	ids := map[string]bool{}
	places := map[string]int{}
	for _, r := range rows {
		c, ok := lids[r.Index]
		if !ok || c.Code == "" {
			return fmt.Errorf("番号のない行: %d", r.Index)
		}
		if ids[c.Code] {
			return fmt.Errorf("番号の重複: %s", c.Code)
		}
		ids[c.Code] = true
		co, err := lidCoordinate(c)
		if err != nil {
			return err
		}
		status := distribution(r, asOf)
		// 照合の要約だけを公開データへ渡し、画像のパスは含めない。
		summary, err := json.Marshal(map[string]string{"byCode": c.ByCode.Status, "byName": c.ByName.Status})
		if err != nil {
			return err
		}
		card := Card{ReviewSourceHash: latestHashes[r.ImageURL], SourceStock: r.Stock, ID: c.Code, City: c.City, Pref: gkp.PrefName(r), Series: r.Dan, Issued: r.Issued, Status: status, Lid: co, PlaceText: r.Place, Hours: r.Hours, Links: r.Links, Acquired: opts.date, Override: overrides[c.Image], Municipality: summary}
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
	registryRaw, err := os.ReadFile(opts.cardIDsPath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(registryRaw, &registry); err != nil {
		return fmt.Errorf("%s: %w", opts.cardIDsPath, err)
	}
	currentIDs := make([]string, 0, len(d.Cards))
	for _, card := range d.Cards {
		currentIDs = append(currentIDs, card.ID)
	}
	if opts.updateCardIDs {
		registry.add(currentIDs)
	}
	if err := registry.validate(currentIDs); err != nil {
		return err
	}
	d.CardAliases = registry.Aliases
	if d.CardAliases == nil {
		d.CardAliases = map[string]string{}
	}
	report.Inputs[opts.cardIDsPath] = hash(registryRaw)
	var images CardImageRecords
	imagesRaw, err := os.ReadFile(opts.cardImagesPath)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(imagesRaw, &images); err != nil {
		return fmt.Errorf("%s: %w", opts.cardImagesPath, err)
	}
	if err := applyCardImages(&d, images); err != nil {
		return err
	}
	report.Inputs[opts.cardImagesPath] = hash(imagesRaw)
	var ledger PlaceLedger
	ledgerRaw, err := os.ReadFile(opts.ledgerPath)
	if err != nil {
		return err
	}
	if err := decodeLedger(ledgerRaw, &ledger); err != nil {
		return fmt.Errorf("%s: %w", opts.ledgerPath, err)
	}
	report.Inputs[placesInputKey] = hash(ledgerRaw)
	evaluation := asOf
	if opts.evaluationDate != "" {
		evaluation, e = time.Parse("2006-01-02", opts.evaluationDate)
		if e != nil {
			return e
		}
	}
	d.EvaluatedAt = evaluation.Format("2006-01-02")
	if err := applyPlaceLedger(&d, ledger, evaluation); err != nil {
		return err
	}
	appendPlacePins(&d)
	if err := assignPinPrefs(&d); err != nil {
		return err
	}

	var updated []byte
	if opts.updateCardIDs {
		updated, err = json.MarshalIndent(registry, "", "  ")
		if err != nil {
			return err
		}
		updated = append(updated, '\n')
		report.Inputs[opts.cardIDsPath] = hash(updated)
	}
	sort.Slice(d.Places, func(i, j int) bool { return d.Places[i].ID < d.Places[j].ID })
	if err := validateOutputDirectories(opts.out, opts.internalOut); err != nil {
		return err
	}
	if err := prepareOutputDir(opts.out); err != nil {
		return err
	}
	if err := prepareOutputDir(opts.internalOut); err != nil {
		return err
	}
	quality, err := qualityReport(d)
	if err != nil {
		return err
	}

	var outputs outputBatch
	defer outputs.cleanup()
	if _, err := outputs.write(filepath.Join(opts.internalOut, "quality.json"), quality); err != nil {
		return err
	}
	internalFull, err := outputs.write(filepath.Join(opts.internalOut, "full.json"), d)
	if err != nil {
		return err
	}
	detail := d
	detail.Pins = nil
	internalDetails, err := outputs.write(filepath.Join(opts.internalOut, "details.json"), detail)
	if err != nil {
		return err
	}
	internalPins, err := outputs.write(filepath.Join(opts.internalOut, "pins.json"), map[string]any{"schema": 1, "updated": opts.date, "pins": d.Pins, "detailsSHA256": internalDetails})
	if err != nil {
		return err
	}

	if _, err := outputs.write(filepath.Join(opts.internalOut, "manifest.json"), map[string]any{"schema": 1, "updated": opts.date, "files": map[string]string{"full.json": internalFull, "details.json": internalDetails, "pins.json": internalPins}, "inputs": report.Inputs, "evaluatedAt": d.EvaluatedAt}); err != nil {
		return err
	}
	public, err := publicData(d)
	if err != nil {
		return err
	}
	full, err := outputs.write(filepath.Join(opts.out, "full.json"), public)
	if err != nil {
		return err
	}
	pins := public.Pins
	public.Pins = nil
	details, err := outputs.write(filepath.Join(opts.out, "details.json"), public)
	if err != nil {
		return err
	}
	boot, err := outputs.write(filepath.Join(opts.out, "pins.json"), PublicPins{1, opts.date, pins, details})
	if err != nil {
		return err
	}

	if _, err := outputs.write(filepath.Join(opts.out, "manifest.json"), PublicManifest{1, opts.date, map[string]string{"full.json": full, "details.json": details, "pins.json": boot}}); err != nil {
		return err
	}
	if updated != nil {
		if err := outputs.stage(opts.cardIDsPath, updated); err != nil {
			return err
		}
	}
	if err := outputs.commit(); err != nil {
		return err
	}
	counts := map[string]int{}
	for _, p := range d.Pins {
		counts[p.Kind]++
	}
	fmt.Printf("カード %d、場所 %d、対応 %d、ピン %v\n", len(d.Cards), len(d.Places), len(d.Relations), counts)
	return nil
}
