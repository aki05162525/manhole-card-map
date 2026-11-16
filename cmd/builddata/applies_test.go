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
		l.Relations[0].Applies = json.RawMessage(`{"kind":"calendar","weekdays":[1,2,3,4,5],"holiday":"exclude"}`)
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
	a := json.RawMessage(`{"kind":"closedDayOf","placeId":"facility:b","closure":"all"}`)
	rows := []LedgerRelation{{CardID: "c", PlaceID: "facility:a", Applies: a}, {CardID: "c", PlaceID: "facility:b"}}
	if err := validateLedgerApplies(rows); err != nil {
		t.Fatal(err)
	}
	if validateMultipleApplies(rows, []Relation{{CardID: "c", PlaceID: "facility:a", HasLedgerRow: true}, {CardID: "c", PlaceID: "facility:b", HasLedgerRow: true}}, true) == nil {
		t.Fatal("missing required applies")
	}
	for _, change := range []func([]LedgerRelation){
		func(r []LedgerRelation) { r[1].CardID = "other" },
		func(r []LedgerRelation) { r[0].PlaceID = "facility:b" },
		func(r []LedgerRelation) { r[1].ValidFrom = "2026-01-01" },
	} {
		copyRows := append([]LedgerRelation(nil), rows...)
		change(copyRows)
		if validateLedgerApplies(copyRows) == nil {
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
	l.Relations[0].Applies = json.RawMessage(`{"kind":"closedDayOf","placeId":"facility:two","closure":"regular"}`)
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
	old.Applies = json.RawMessage(`{"kind":"closedDayOf","placeId":"missing","closure":"all"}`)
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

func TestLedgerAppliesErrorsIdentifyRelation(t *testing.T) {
	for _, rawApplies := range []string{
		`{"kind":"calendar","weekdays":[8],"holiday":"include"}`,
		`{"kind":"text","label":"GKPの原典"}`,
	} {
		d, l := pilotFixture(t)
		raw, _ := json.Marshal(l)
		var input map[string]any
		_ = json.Unmarshal(raw, &input)
		row := input["relations"].([]any)[0].(map[string]any)
		row["id"] = "relation:broken"
		var value any
		_ = json.Unmarshal([]byte(rawApplies), &value)
		row["applies"] = value
		raw, _ = json.Marshal(input)
		var decoded PlaceLedger
		if err := decodeLedger(raw, &decoded); err != nil {
			t.Fatalf("applies decoded before relation IDs were available: %v", err)
		}
		err := applyPlaceLedger(&d, decoded, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC))
		if err == nil {
			t.Fatal("invalid applies accepted")
		}
		if strings.Contains(err.Error(), "relation /:") {
			t.Fatalf("empty IDs in error: %v", err)
		}
		for _, id := range []string{"relation:broken", "card-a", "facility:one"} {
			if !strings.Contains(err.Error(), id) {
				t.Errorf("error lacks %s: %v", id, err)
			}
		}
	}
}

func TestAppliesRequiresSourceOnlyCounterLedgerRow(t *testing.T) {
	d, l := pilotFixture(t)
	d.Places = append(d.Places, Place{ID: "place:unreviewed"})
	d.Relations = append(d.Relations, Relation{CardID: "card-a", PlaceID: "place:unreviewed"})
	source, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	run := func(required bool) error {
		d = Data{}
		if err := json.Unmarshal(source, &d); err != nil {
			t.Fatal(err)
		}
		return applyPlaceLedgerWithAppliesRequirement(&d, l, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC), required)
	}
	if err := run(false); err != nil {
		t.Fatal(err)
	}
	if err := run(true); err == nil || !strings.Contains(err.Error(), "card-a/place:unreviewed: no ledger row; cannot attach applies") {
		t.Fatalf("missing ledger row not identified: %v", err)
	}
	q := appliesQuality(d.Relations)
	if q["missingLedgerRow"]["multiple"] != 1 || q["missingLedgerRow"]["total"] != 1 || q["missing"]["multiple"] != 2 {
		t.Fatalf("source-only counter not counted: %v", q)
	}
	// With both counters in the ledger, require a value in every period row.
	p := l.Places[0]
	p.ID = "facility:two"
	p.LegacyIDs = []string{"place:unreviewed"}
	l.Places = append(l.Places, p)
	l.Relations[0].ID = "relation:one"
	l.Relations[0].Applies = json.RawMessage(`{"kind":"openDays"}`)
	r := l.Relations[0]
	r.ID = "relation:two"
	r.PlaceID = "facility:two"
	r.Applies = json.RawMessage(`null`)
	l.Relations = append(l.Relations, r)
	for _, missing := range []json.RawMessage{nil, json.RawMessage(`null`)} {
		l.Relations[1].Applies = missing
		err := run(true)
		if err == nil {
			t.Fatal("required NULL applies accepted")
		}
		for _, want := range []string{"relation:two", "card-a", "facility:two", "missing applies"} {
			if !strings.Contains(err.Error(), want) {
				t.Fatalf("error lacks %s: %v", want, err)
			}
		}
	}
	l.Relations[1].Applies = json.RawMessage(`{"kind":"openDays"}`)
	// Past periods are checked even when today's selected row has a value.
	old := l.Relations[1]
	old.ID = "relation:past"
	old.Applies = nil
	old.ValidTo = "2025-12-31"
	l.Relations[1].ValidFrom = "2026-01-01"
	l.Relations = append(l.Relations, old)
	if err := run(true); err == nil || !strings.Contains(err.Error(), "relation:past") {
		t.Fatalf("past period's NULL applies accepted: %v", err)
	}
	l.Relations = l.Relations[:2]
	if err := run(true); err != nil {
		t.Fatal(err)
	}
	q = appliesQuality(d.Relations)
	if q["missingLedgerRow"]["total"] != 0 || q["missing"]["total"] != 0 {
		t.Fatal(q)
	}
}
