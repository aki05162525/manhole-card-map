package main

import (
	"fmt"
	"regexp"
	"strings"
)

// Reject editorial leakage at the public boundary, including unreviewed source
// conditions. Correct the ledger; never silently strip or rewrite display text.
var maintenanceConditionTerms = []string{
	"gkp", "unknown", "採用", "原典", "併読", "旧入力", "上書きしない", "推定しない",
	"転用しない", "拡張しない", "解釈しない", "承認しない", "同一性", "未実装",
	"関係は保持", "関係を保持", "再確認期限", "404", "原文の", "追加取得", "照合", "台帳", "sourcehash",
}

var stockGuarantee = regexp.MustCompile(`在庫[^。\n]*保証`)

func validatePublicCondition(r Relation) error {
	condition := strings.ToLower(r.Condition)
	for _, term := range maintenanceConditionTerms {
		if strings.Contains(condition, term) {
			return fmt.Errorf("relation %s/%s: condition contains maintenance term %q; move the note to maintenanceNotes", r.CardID, r.PlaceID, term)
		}
	}
	if stockGuarantee.MatchString(condition) {
		return fmt.Errorf("relation %s/%s: condition contains a stock guarantee statement; move the note to maintenanceNotes", r.CardID, r.PlaceID)
	}
	return nil
}

// Public types are an explicit allowlist. Never embed internal types or raw JSON:
// adding an audit field must not silently add it to browser assets.
type PublicCoordinate struct {
	Status string   `json:"status"`
	Lat    *float64 `json:"lat,omitempty"`
	Lng    *float64 `json:"lng,omitempty"`
}
type PublicCard struct {
	ID        string    `json:"id"`
	City      string    `json:"city"`
	Pref      string    `json:"pref"`
	Series    string    `json:"series"`
	Issued    string    `json:"issued"`
	Status    string    `json:"status"`
	Lid       PublicLid `json:"lid"`
	PlaceText []string  `json:"placeText"`
	Hours     []string  `json:"hours"`
	Links     []string  `json:"links"`
	Acquired  string    `json:"acquired"`
}
type PublicPlace struct {
	LocationReview *PublicLocationReview `json:"locationReview,omitempty"`
	ID             string                `json:"id"`
	Name           string                `json:"name"`
	Address        string                `json:"address"`
	Phone          string                `json:"phone"`
	Coordinate     PublicCoordinate      `json:"coordinate"`
}
type PublicRelation struct {
	Hours          []string        `json:"hours,omitempty"`
	Status         string          `json:"status,omitempty"`
	ValidFrom      string          `json:"validFrom,omitempty"`
	ValidTo        string          `json:"validTo,omitempty"`
	Review         string          `json:"review,omitempty"`
	Evidence       *PublicEvidence `json:"evidence,omitempty"`
	CardID         string          `json:"cardId"`
	PlaceID        string          `json:"placeId"`
	Condition      string          `json:"condition"`
	PeriodRaw      string          `json:"periodRaw"`
	AlternativeRaw string          `json:"alternativeRaw"`
}
type PublicPin struct {
	Pref    string   `json:"pref"`
	ID      string   `json:"id"`
	CardIDs []string `json:"cardIds"`
	Kind    string   `json:"kind"`
	Status  string   `json:"status"`
	Lat     float64  `json:"lat"`
	Lng     float64  `json:"lng"`
	// Always false: no reference pins are built, but the published shape keeps the field.
	Reference bool `json:"reference"`
}
type PublicData struct {
	CardAliases map[string]string `json:"cardAliases"`
	EvaluatedAt string            `json:"evaluatedAt,omitempty"`
	Schema      int               `json:"schema"`
	Updated     string            `json:"updated"`
	Cards       []PublicCard      `json:"cards"`
	Places      []PublicPlace     `json:"places"`
	Relations   []PublicRelation  `json:"relations"`
	Pins        []PublicPin       `json:"pins"`
}
type PublicEvidence struct {
	SourceURL string `json:"sourceUrl"`
	CheckedAt string `json:"checkedAt"`
}
type PublicLocationReview struct {
	Status        string `json:"status"`
	AddressStatus string `json:"addressStatus"`
	Reason        string `json:"reason"`
}
type PublicLid struct {
	Status string   `json:"status"`
	Lat    *float64 `json:"lat,omitempty"`
	Lng    *float64 `json:"lng,omitempty"`
	Reason string   `json:"reason,omitempty"`
}
type PublicManifest struct {
	Schema  int               `json:"schema"`
	Updated string            `json:"updated"`
	Files   map[string]string `json:"files"`
}
type PublicPins struct {
	Schema        int         `json:"schema"`
	Updated       string      `json:"updated"`
	Pins          []PublicPin `json:"pins"`
	DetailsSHA256 string      `json:"detailsSHA256"`
}

func publicData(d Data) (PublicData, error) {
	p := PublicData{CardAliases: d.CardAliases, Schema: d.Schema, Updated: d.Updated, EvaluatedAt: d.EvaluatedAt,
		Cards: []PublicCard{}, Places: []PublicPlace{}, Relations: []PublicRelation{}, Pins: []PublicPin{}}
	for _, c := range d.Cards {
		p.Cards = append(p.Cards, PublicCard{ID: c.ID, City: c.City, Pref: c.Pref, Series: c.Series, Issued: c.Issued,
			Status: c.Status, Lid: PublicLid{c.Lid.Status, c.Lid.Lat, c.Lid.Lng, c.Lid.Reason}, PlaceText: c.PlaceText,
			Hours: c.Hours, Links: c.Links, Acquired: c.Acquired})
	}
	for _, v := range d.Places {
		var review *PublicLocationReview
		if v.LocationReview != nil {
			r := v.LocationReview
			review = &PublicLocationReview{r.Status, r.AddressStatus, r.Reason}
		}
		p.Places = append(p.Places, PublicPlace{ID: v.ID, Name: v.Name, Address: v.Address, Phone: v.Phone,
			Coordinate: PublicCoordinate{v.Coordinate.Status, v.Coordinate.Lat, v.Coordinate.Lng}, LocationReview: review})
	}
	for _, r := range d.Relations {
		if err := validatePublicCondition(r); err != nil {
			return PublicData{}, err
		}
		var evidence *PublicEvidence
		if r.Evidence != nil {
			evidence = &PublicEvidence{r.Evidence.SourceURL, r.Evidence.CheckedAt}
		}
		p.Relations = append(p.Relations, PublicRelation{CardID: r.CardID, PlaceID: r.PlaceID, Condition: r.Condition,
			PeriodRaw: r.PeriodRaw, AlternativeRaw: r.AlternativeRaw, Hours: r.Hours, Status: r.Status,
			ValidFrom: r.ValidFrom, ValidTo: r.ValidTo, Review: r.Review, Evidence: evidence})
	}
	for _, v := range d.Pins {
		p.Pins = append(p.Pins, PublicPin{v.Pref, v.ID, v.CardIDs, v.Kind, v.Status, v.Lat, v.Lng, false})
	}
	return p, nil
}
