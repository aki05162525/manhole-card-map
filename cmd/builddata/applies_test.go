package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestAppliesShape(t *testing.T) {
	valid := []string{
		`{"kind":"openDays"}`, `{"kind":"calendar","weekdays":[],"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[1,7],"holiday":"asWeekday","season":{"from":"10-01","to":"03-31"}}`,
		`{"kind":"annual","from":"02-29","to":"01-03"}`,
		`{"kind":"closedDayOf","placeId":"facility:two","closure":"temporary"}`,
		`{"kind":"except","base":{"kind":"openDays"},"excluded":{"kind":"text","label":"清掃日"}}`,
		`{"kind":"any","items":[{"kind":"openDays"},{"kind":"text","label":"特別開館日"}]}`,
	}
	invalid := []string{
		`{}`, `[]`, `{"kind":"always"}`, `{"kind":"openDays","label":"余分"}`,
		`{"kind":"calendar","weekdays":[1,1],"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[0],"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[8],"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[1.5],"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[],"holiday":"exclude"}`,
		`{"kind":"calendar","weekdays":null,"holiday":"include"}`,
		`{"kind":"calendar","weekdays":[1]}`,
		`{"kind":"calendar","weekdays":[1],"holiday":"wrong"}`,
		`{"kind":"calendar","weekdays":[1],"holiday":"include","season":null}`,
		`{"kind":"annual","from":"02-30","to":"01-03"}`,
		`{"kind":"annual","from":"2-01","to":"01-03"}`,
		`{"kind":"annual","from":"12-31"}`,
		`{"kind":"closedDayOf","placeId":"","closure":"all"}`,
		`{"kind":"closedDayOf","placeId":"f","closure":"stock"}`,
		`{"kind":"text","label":" "}`, `{"kind":"text","label":"GKPの原典"}`,
		`{"kind":"text","label":"休日","unsure":true}`,
		`{"kind":"all","items":[{"kind":"openDays"}]}`,
		`{"kind":"except","base":{"kind":"openDays"}}`,
		`{"kind":"except","base":null,"excluded":{"kind":"openDays"}}`,
	}
	for _, raw := range valid {
		var a Applies
		if err := json.Unmarshal([]byte(raw), &a); err != nil {
			t.Errorf("%s: %v", raw, err)
		}
	}
	for _, raw := range invalid {
		var a Applies
		if err := json.Unmarshal([]byte(raw), &a); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	raw := `{"kind":"openDays"}`
	for range 40 {
		raw = `{"kind":"except","base":` + raw + `,"excluded":{"kind":"openDays"}}`
	}
	var a Applies
	if json.Unmarshal([]byte(raw), &a) == nil {
		t.Fatal("accepted excessive depth")
	}
}

func TestAppliesPublicationAndStaleEvidence(t *testing.T) {
	for _, stale := range []bool{false, true} {
		d, l := pilotFixture(t)
		l.Relations[0].Applies = &Applies{Kind: "calendar", Weekdays: []int{1, 2, 3, 4, 5}, Holiday: "exclude"}
		if stale {
			l.Relations[0].SourceHash = strings.Repeat("a", 64)
		}
		if err := applyPlaceLedger(&d, l, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatal(err)
		}
		p, err := publicData(d)
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := json.Marshal(p)
		if strings.Contains(string(raw), `"applies"`) == stale {
			t.Fatalf("stale=%v: %s", stale, raw)
		}
	}
}

func TestAppliesReferencesAndCoverage(t *testing.T) {
	a := &Applies{Kind: "closedDayOf", PlaceID: "facility:b", Closure: "all"}
	rows := []LedgerRelation{{CardID: "c", PlaceID: "facility:a", Applies: a}, {CardID: "c", PlaceID: "facility:b"}}
	if err := validateLedgerApplies(rows, false); err != nil {
		t.Fatal(err)
	}
	if validateLedgerApplies(rows, true) == nil {
		t.Fatal("missing required applies")
	}
	for _, change := range []func([]LedgerRelation){
		func(r []LedgerRelation) { r[1].CardID = "other" },
		func(r []LedgerRelation) { r[0].PlaceID = "facility:b" },
		func(r []LedgerRelation) { r[1].ValidFrom = "2026-01-01" },
	} {
		copyRows := append([]LedgerRelation(nil), rows...)
		change(copyRows)
		if validateLedgerApplies(copyRows, false) == nil {
			t.Fatal("accepted invalid reference")
		}
	}
}

func TestAppliesQualityCountsRelationsNotNodes(t *testing.T) {
	text := &Applies{Kind: "text", Label: "清掃日"}
	d := Data{Relations: []Relation{
		{CardID: "c", PlaceID: "a", Applies: &Applies{Kind: "all", Items: []*Applies{text, text}}},
		{CardID: "c", PlaceID: "b"}, {CardID: "d", PlaceID: "a"},
	}}
	q := appliesQuality(d.Relations)
	if q["missing"]["total"] != 2 || q["missing"]["multiple"] != 1 || q["missing"]["single"] != 1 || q["text"]["total"] != 1 {
		t.Fatal(q)
	}
}

func TestAppliesReferencedFacilityIsPublishedWithCanonicalID(t *testing.T) {
	d, l := pilotFixture(t)
	d.Places = append(d.Places, Place{ID: "place:two"})
	d.Relations = append(d.Relations, Relation{CardID: "card-a", PlaceID: "place:two"})
	p := l.Places[0]
	p.ID = "facility:two"
	p.LegacyIDs = []string{"place:two"}
	l.Places = append(l.Places, p)
	r := l.Relations[0]
	r.PlaceID = p.ID
	l.Relations = append(l.Relations, r)
	l.Relations[0].Applies = &Applies{Kind: "closedDayOf", PlaceID: p.ID, Closure: "regular"}
	if err := applyPlaceLedger(&d, l, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	published, err := publicData(d)
	if err != nil {
		t.Fatal(err)
	}
	if published.Relations[0].Applies.PlaceID != published.Relations[1].PlaceID {
		t.Fatal(published.Relations)
	}
	// An invalid non-selected period must not be hidden by effectiveRelation.
	old := l.Relations[0]
	old.ValidTo = "2025-12-31"
	old.Applies = &Applies{Kind: "closedDayOf", PlaceID: "missing", Closure: "all"}
	l.Relations[0].ValidFrom = "2026-01-01"
	l.Relations = append(l.Relations, old)
	if applyPlaceLedger(&d, l, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC)) == nil {
		t.Fatal("invalid old period accepted")
	}
}

func TestHolidayOnlyAppliesKeepsEmptyWeekdays(t *testing.T) {
	var a Applies
	if err := json.Unmarshal([]byte(`{"kind":"calendar","weekdays":[],"holiday":"include"}`), &a); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"weekdays":[]`) {
		t.Fatal(string(raw))
	}
	var again Applies
	if err := json.Unmarshal(raw, &again); err != nil {
		t.Fatal(err)
	}
}
