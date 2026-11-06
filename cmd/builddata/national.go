package main

import (
	"fmt"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"os"
	"reflect"
	"sort"
	"strings"
)

// Identical shared entries are idempotent. No last-writer-wins semantics.
func mergeLedgers(inputs []PlaceLedger) (PlaceLedger, error) {
	out := PlaceLedger{Schema: 1, Places: []LedgerPlace{}, Relations: []LedgerRelation{}}
	places := map[string]LedgerPlace{}
	relations := map[string]LedgerRelation{}
	aliases := map[string]string{}
	for _, l := range inputs {
		if l.Schema != 1 {
			return out, fmt.Errorf("unsupported ledger schema %d", l.Schema)
		}
		for _, p := range l.Places {
			if old, ok := places[p.ID]; ok {
				if !reflect.DeepEqual(old, p) {
					return out, fmt.Errorf("conflicting facility %s", p.ID)
				}
				continue
			}
			for _, a := range p.LegacyIDs {
				if owner, ok := aliases[a]; ok {
					return out, fmt.Errorf("legacy alias collision %s: %s / %s", a, owner, p.ID)
				}
				aliases[a] = p.ID
			}
			places[p.ID] = p
			out.Places = append(out.Places, p)
		}
		for _, r := range l.Relations {
			key := r.CardID + "\x00" + r.PlaceID
			if old, ok := relations[key]; ok {
				if !reflect.DeepEqual(old, r) {
					return out, fmt.Errorf("conflicting relation %s / %s", r.CardID, r.PlaceID)
				}
				continue
			}
			relations[key] = r
			out.Relations = append(out.Relations, r)
		}
	}
	sort.Slice(out.Places, func(i, j int) bool { return out.Places[i].ID < out.Places[j].ID })
	sort.Slice(out.Relations, func(i, j int) bool {
		a, b := out.Relations[i], out.Relations[j]
		return a.CardID+"\x00"+a.PlaceID < b.CardID+"\x00"+b.PlaceID
	})
	return out, nil
}

type AuditCard struct {
	CardID    string   `json:"cardId"`
	Relations int      `json:"relations"`
	Verified  int      `json:"verifiedRelations"`
	Reasons   []string `json:"unresolvedReasons"`
}
type AuditRelation struct {
	CardID      string   `json:"cardId"`
	PlaceID     string   `json:"placeId"`
	Review      string   `json:"review"`
	Status      string   `json:"status"`
	Coordinate  string   `json:"coordinateStatus"`
	ValidFrom   string   `json:"validFrom,omitempty"`
	ValidTo     string   `json:"validTo,omitempty"`
	ReviewUntil string   `json:"reviewUntil,omitempty"`
	Reasons     []string `json:"unresolvedReasons"`
}
type NationalAudit struct {
	Schema                   int               `json:"schema"`
	EvaluatedAt              string            `json:"evaluatedAt"`
	Inputs                   map[string]string `json:"inputSHA256"`
	Cards                    []AuditCard       `json:"cards"`
	Relations                []AuditRelation   `json:"relations"`
	ConfirmedFacilities      int               `json:"confirmedFacilities"`
	VerifiedRelations        int               `json:"verifiedRelations"`
	LocatedVerifiedRelations int               `json:"locatedVerifiedRelations"`
}

func nationalAudit(d Data) NationalAudit {
	a := NationalAudit{Schema: 1, EvaluatedAt: d.EvaluatedAt, Cards: []AuditCard{}, Relations: []AuditRelation{}}
	places := map[string]Place{}
	counts := map[string]int{}
	verified := map[string]int{}
	unresolved := map[string]bool{}
	for _, p := range d.Places {
		places[p.ID] = p
		if p.Coordinate.Status == "confirmed" && p.Coordinate.Lat != nil && p.Coordinate.Lng != nil {
			a.ConfirmedFacilities++
		}
	}
	for _, r := range d.Relations {
		p := places[r.PlaceID]
		row := AuditRelation{CardID: r.CardID, PlaceID: r.PlaceID, Review: r.Review, Status: r.Status, Coordinate: p.Coordinate.Status, ValidFrom: r.ValidFrom, ValidTo: r.ValidTo, ReviewUntil: r.ReviewUntil, Reasons: []string{}}
		counts[r.CardID]++
		if r.Review == "verified" {
			a.VerifiedRelations++
			verified[r.CardID]++
		} else {
			row.Reasons = append(row.Reasons, "distribution relation needs evidence review")
			if r.Interpretation != "" {
				row.Reasons = append(row.Reasons, r.Interpretation)
			}
		}
		if p.Coordinate.Status != "confirmed" || p.Coordinate.Lat == nil || p.Coordinate.Lng == nil {
			row.Reasons = append(row.Reasons, "facility destination coordinate is not confirmed")
			if p.Coordinate.Reason != "" {
				row.Reasons = append(row.Reasons, p.Coordinate.Reason)
			}
		} else if r.Review == "verified" {
			a.LocatedVerifiedRelations++
		}
		if r.Status == "unknown" || r.Status == "" {
			row.Reasons = append(row.Reasons, "distribution state unresolved")
		}
		if len(row.Reasons) > 0 {
			unresolved[r.CardID] = true
		}
		a.Relations = append(a.Relations, row)
	}
	for _, c := range d.Cards {
		row := AuditCard{CardID: c.ID, Relations: counts[c.ID], Verified: verified[c.ID], Reasons: []string{}}
		if row.Relations == 0 {
			row.Reasons = append(row.Reasons, "no extracted distribution relation; manual review required")
		}
		if unresolved[c.ID] {
			row.Reasons = append(row.Reasons, "see unresolved relation rows")
		}
		a.Cards = append(a.Cards, row)
	}
	sort.Slice(a.Cards, func(i, j int) bool { return a.Cards[i].CardID < a.Cards[j].CardID })
	sort.SliceStable(a.Relations, func(i, j int) bool {
		x, y := a.Relations[i], a.Relations[j]
		return x.CardID+"\x00"+x.PlaceID < y.CardID+"\x00"+y.PlaceID
	})
	return a
}
func writeNationalAudit(prefix string, a NationalAudit) error {
	write(prefix+".json", a)
	var b strings.Builder
	fmt.Fprintf(&b, "# 全国配布監査\n\n判定日: %s。監査行の生成は人・AIによる個別調査完了を意味しない。\n\nカード %d、関係 %d、施設座標確定 %d、根拠確認済み関係 %d、座標確定施設との確認済み関係 %d。休止・終了・予定も関係確認件数に含む。\n\n|カード|関係数|確認済み関係|未解決理由|\n|---|---:|---:|---|\n", a.EvaluatedAt, len(a.Cards), len(a.Relations), a.ConfirmedFacilities, a.VerifiedRelations, a.LocatedVerifiedRelations)
	for _, c := range a.Cards {
		fmt.Fprintf(&b, "|%s|%d|%d|%s|\n", c.CardID, c.Relations, c.Verified, strings.Join(c.Reasons, "; "))
	}
	b.WriteString("\n|カード|施設|関係確認|状態|座標|適用開始|適用終了|確認期限|未解決理由|\n|---|---|---|---|---|---|---|---|---|\n")
	escape := func(s string) string { return strings.NewReplacer("|", "\\|", "\n", "<br>", "\r", "").Replace(s) }
	for _, r := range a.Relations {
		fmt.Fprintf(&b, "|%s|%s|%s|%s|%s|%s|%s|%s|%s|\n", escape(r.CardID), escape(r.PlaceID), escape(r.Review), escape(r.Status), escape(r.Coordinate), r.ValidFrom, r.ValidTo, r.ReviewUntil, escape(strings.Join(r.Reasons, "; ")))
	}
	b.WriteString("\n原文・根拠・変更履歴は内部出力 data/work/internal-data/full.json と統合台帳を参照。\n")
	return os.WriteFile(prefix+".md", []byte(b.String()), 0644)
}

// Review current distribution fields by exact image identity, never row index.
// Additions/removals require an explicit identity migration before this build.
func reviewHashes(before, current []gkp.Row) (map[string]string, error) {
	next := map[string]gkp.Row{}
	out := map[string]string{}
	for _, r := range current {
		if strings.TrimSpace(r.ImageURL) == "" {
			return nil, fmt.Errorf("empty current image")
		}
		if _, ok := next[r.ImageURL]; ok {
			return nil, fmt.Errorf("duplicate current image %s", r.ImageURL)
		}
		next[r.ImageURL] = r
	}
	for _, r := range before {
		if _, ok := out[r.ImageURL]; ok {
			return nil, fmt.Errorf("duplicate baseline image %s", r.ImageURL)
		}
		n, ok := next[r.ImageURL]
		if !ok {
			return nil, fmt.Errorf("current image absent; reconcile printed identity first: %s", r.ImageURL)
		}
		out[r.ImageURL] = cardSourceHash(Card{PlaceText: n.Place, Hours: n.Hours, SourceStock: n.Stock, Links: n.Links})
	}
	if len(next) != len(out) {
		return nil, fmt.Errorf("current list contains new images; reconcile printed identities first")
	}
	return out, nil
}
