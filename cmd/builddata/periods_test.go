package main

import (
	"strings"
	"testing"
	"time"
)

// periodFixture gives card-a two reviewed periods at facility:one: spring and autumn.
func periodFixture(t *testing.T) (Data, PlaceLedger) {
	t.Helper()
	d, l := pilotFixture(t)
	spring := l.Relations[0]
	spring.ValidFrom, spring.ValidTo = "2026-04-01", "2026-05-31"
	spring.Hours = []string{"9-17"}
	autumn := spring
	autumn.ValidFrom, autumn.ValidTo = "2026-09-01", "2026-10-31"
	autumn.Hours = []string{"10-16"}
	condition := "土日のみ"
	autumn.Condition = &condition
	// Listed out of order: the choice must not depend on the ledger order.
	l.Relations = []LedgerRelation{autumn, spring}
	return d, l
}

func TestPeriodsOfOneCardAndFacilityFollowTheEvaluationDate(t *testing.T) {
	for _, tc := range []struct{ date, status, from, hours, condition string }{
		{"2026-03-01", "upcoming", "2026-04-01", "9-17", ""},
		{"2026-04-01", "active", "2026-04-01", "9-17", ""},
		{"2026-05-31", "active", "2026-04-01", "9-17", ""},
		{"2026-07-01", "upcoming", "2026-09-01", "10-16", "土日のみ"},
		{"2026-10-31", "active", "2026-09-01", "10-16", "土日のみ"},
		{"2026-11-05", "ended", "2026-09-01", "10-16", "土日のみ"},
	} {
		d, l := periodFixture(t)
		now, _ := time.Parse("2006-01-02", tc.date)
		if err := applyPlaceLedger(&d, l, now); err != nil {
			t.Fatalf("%s: %v", tc.date, err)
		}
		r := d.Relations[0]
		if len(d.Relations) != 1 || r.Review != "verified" || r.Status != tc.status || r.ValidFrom != tc.from ||
			r.Hours[0] != tc.hours || r.Condition != tc.condition {
			t.Fatalf("%s: %+v", tc.date, d.Relations)
		}
	}
}

func TestPeriodsMustNotOverlap(t *testing.T) {
	for name, change := range map[string]func(*PlaceLedger){
		"overlapping":    func(l *PlaceLedger) { l.Relations[0].ValidFrom = "2026-05-31" },
		"one open start": func(l *PlaceLedger) { l.Relations[0].ValidFrom = "" },
		"no period":      func(l *PlaceLedger) { l.Relations[1].ValidFrom, l.Relations[1].ValidTo = "", "" },
		"same period":    func(l *PlaceLedger) { l.Relations[0].ValidFrom, l.Relations[0].ValidTo = "2026-04-01", "2026-05-31" },
	} {
		d, l := periodFixture(t)
		change(&l)
		err := applyPlaceLedger(&d, l, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
		if err == nil || !strings.Contains(err.Error(), "overlapping relation periods") {
			t.Fatalf("%s: %v", name, err)
		}
	}
}

func TestOpenEndedLaterPeriodIsAccepted(t *testing.T) {
	d, l := periodFixture(t)
	l.Relations[0].ValidTo = ""
	if err := applyPlaceLedger(&d, l, time.Date(2027, 1, 5, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if r := d.Relations[0]; r.Status != "active" || r.ValidFrom != "2026-09-01" || r.ValidTo != "" {
		t.Fatalf("%+v", r)
	}
}

func TestPeriodsOfAnAddedCounterShareItsChange(t *testing.T) {
	added := func(t *testing.T) (Data, PlaceLedger) {
		d, l := pilotFixture(t)
		l.Places = append(l.Places, LedgerPlace{ID: "facility:new", Name: "New", Address: "New address", Evidence: l.Places[0].Evidence})
		change := &RelationChange{Kind: "addition", Reason: "official seasonal counter", PreviousPlaceIDs: []string{"place:old"}, Raw: []string{"official notice"}}
		spring := LedgerRelation{CardID: "card-a", PlaceID: "facility:new", SourceHash: l.Relations[0].SourceHash, Status: "active", Evidence: l.Relations[0].Evidence, Change: change, ValidFrom: "2026-04-01", ValidTo: "2026-05-31"}
		autumn := spring
		autumn.ValidFrom, autumn.ValidTo = "2026-09-01", "2026-10-31"
		l.Relations = append(l.Relations, spring, autumn)
		return d, l
	}
	d, l := added(t)
	if err := applyPlaceLedger(&d, l, time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if len(d.Relations) != 2 || d.Relations[1].PlaceID != "facility:new" || d.Relations[1].ValidFrom != "2026-09-01" {
		t.Fatalf("%+v", d.Relations)
	}
	d, l = added(t)
	other := *l.Relations[2].Change
	other.Reason = "another reason"
	l.Relations[2].Change = &other
	if err := applyPlaceLedger(&d, l, time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC)); err == nil || !strings.Contains(err.Error(), "disagree on change") {
		t.Fatal(err)
	}
}
