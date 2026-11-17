package main

import (
	"encoding/json"
	"reflect"
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

// laterPeriodFixture gives card-a at facility:one a current period up to 2027-01-19
// and a reviewed later period from 2027-01-20 with shorter hours (Mibu A2, Issue #254).
func laterPeriodFixture(t *testing.T) (Data, PlaceLedger) {
	t.Helper()
	d, l := pilotFixture(t)
	current := l.Relations[0]
	current.ValidTo = "2027-01-19"
	current.Hours = []string{"9:00～17:00", "在庫がなくなり次第終了"}
	current.parsedApplies, current.Applies = nil, []byte(`{"kind":"calendar","weekdays":[6,7],"holiday":"include"}`)
	later := current
	later.ValidFrom, later.ValidTo = "2027-01-20", ""
	later.Hours = []string{"9:00～16:30", "在庫がなくなり次第終了"}
	// Listed later row first: the choice must not depend on the ledger order.
	l.Relations = []LedgerRelation{later, current}
	return d, l
}

func applyAt(t *testing.T, d *Data, l PlaceLedger, date string) {
	t.Helper()
	now, _ := time.Parse("2006-01-02", date)
	if err := applyPlaceLedger(d, l, now); err != nil {
		t.Fatalf("%s: %v", date, err)
	}
	appendPlacePins(d)
}

func TestLaterPeriodIsShownAsAnUpcomingChangeUntilItStarts(t *testing.T) {
	d, l := laterPeriodFixture(t)
	applyAt(t, &d, l, "2027-01-19")
	r := d.Relations[0]
	if len(d.Relations) != 1 || r.Status != "active" || r.Hours[0] != "9:00～17:00" || len(r.Upcoming) != 1 {
		t.Fatalf("%+v", d.Relations)
	}
	u := r.Upcoming[0]
	if u.ValidFrom != "2027-01-20" || u.ValidTo != "" || u.Status != "active" || u.Hours[0] != "9:00～16:30" ||
		u.Applies == nil || u.Applies.Kind != "calendar" || len(u.Applies.Weekdays) != 2 {
		t.Fatalf("%+v", u)
	}

	d, l = laterPeriodFixture(t)
	applyAt(t, &d, l, "2027-01-20")
	if r := d.Relations[0]; r.Hours[0] != "9:00～16:30" || r.ValidFrom != "2027-01-20" || len(r.Upcoming) != 0 {
		t.Fatalf("after the change: %+v", r)
	}
}

// Dazaifu: a closed period between two open ones. Only the period after the
// current one is announced; the plan changes no status, pin or counter.
func TestUpcomingChangeDoesNotAlterCurrentStatusPinsOrCounters(t *testing.T) {
	build := func(withLater bool) Data {
		d, l := pilotFixture(t)
		before := l.Relations[0]
		before.ValidTo = "2026-09-30"
		closed := before
		closed.ValidFrom, closed.ValidTo, closed.Status = "2026-10-01", "2026-12-22", "suspended"
		after := before
		after.ValidFrom, after.ValidTo, after.Status = "2026-12-23", "", "active"
		l.Relations = []LedgerRelation{closed, before}
		if withLater {
			l.Relations = append([]LedgerRelation{after}, l.Relations...)
		}
		applyAt(t, &d, l, "2026-11-17")
		return d
	}
	with, without := build(true), build(false)
	r := with.Relations[0]
	if r.Status != "suspended" || len(r.Upcoming) != 1 || r.Upcoming[0].ValidFrom != "2026-12-23" || r.Upcoming[0].Status != "active" {
		t.Fatalf("%+v", with.Relations)
	}
	if with.Cards[0].Status != without.Cards[0].Status || with.Cards[0].Status != "suspended" ||
		len(with.Relations) != len(without.Relations) || !reflect.DeepEqual(with.Pins, without.Pins) || with.Pins[0].Status != "suspended" {
		t.Fatalf("the plan changed the present: %+v / %+v", with, without)
	}
}

// Ota museum: a closure from 2026-11-30 whose recheck is due 2027-03-31. The
// review date is not a reopening: nothing announces one, and once it passes the
// closure itself needs review instead of turning active.
func TestReviewDateIsNotAnnouncedAsReopening(t *testing.T) {
	ota := func() (Data, PlaceLedger) {
		d, l := pilotFixture(t)
		open := l.Relations[0]
		open.ValidTo = "2026-11-29"
		closure := open
		closure.ValidFrom, closure.ValidTo, closure.Status, closure.ReviewUntil = "2026-11-30", "", "suspended", "2027-03-31"
		l.Relations = []LedgerRelation{closure, open}
		return d, l
	}
	d, l := ota()
	applyAt(t, &d, l, "2026-11-17")
	r := d.Relations[0]
	if r.Status != "active" || len(r.Upcoming) != 1 {
		t.Fatalf("%+v", r)
	}
	if u := r.Upcoming[0]; u.ValidFrom != "2026-11-30" || u.ValidTo != "" || u.Status != "suspended" {
		t.Fatalf("%+v", u)
	}
	p, err := publicData(d)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(p)
	if strings.Contains(string(b), "2027-03-31") || strings.Contains(string(b), "reviewUntil") {
		t.Fatalf("review date published: %s", b)
	}

	d, l = ota()
	applyAt(t, &d, l, "2027-04-01")
	if r := d.Relations[0]; r.Review != "needs-review" || r.Status != "unknown" || len(r.Upcoming) != 0 || d.Cards[0].Status == "active" {
		t.Fatalf("expired closure: %+v / %+v", r, d.Cards[0])
	}
}

func TestUncheckedLaterPeriodIsNotAnnounced(t *testing.T) {
	for name, change := range map[string]func(*LedgerRelation){
		"source changed": func(r *LedgerRelation) { r.SourceHash = strings.Repeat("0", 64) },
		"review expired": func(r *LedgerRelation) { r.ReviewUntil = "2027-01-18" },
	} {
		d, l := laterPeriodFixture(t)
		change(&l.Relations[0])
		applyAt(t, &d, l, "2027-01-19")
		if r := d.Relations[0]; r.Review != "verified" || r.Hours[0] != "9:00～17:00" || len(r.Upcoming) != 0 {
			t.Fatalf("%s: %+v", name, r)
		}
	}
	// An unchecked period also hides the periods after it: they would skip a change.
	d, l := laterPeriodFixture(t)
	l.Relations[0].ValidTo = "2027-03-31"
	l.Relations[0].SourceHash = strings.Repeat("0", 64)
	third := l.Relations[1]
	third.ValidFrom, third.ValidTo = "2027-04-01", ""
	l.Relations = append(l.Relations, third)
	applyAt(t, &d, l, "2027-01-19")
	if r := d.Relations[0]; len(r.Upcoming) != 0 {
		t.Fatalf("skipped an unchecked period: %+v", r.Upcoming)
	}
	// Nor does an unchecked current period announce what follows.
	d, l = laterPeriodFixture(t)
	l.Relations[1].SourceHash = strings.Repeat("0", 64)
	applyAt(t, &d, l, "2027-01-19")
	if r := d.Relations[0]; r.Review != "needs-review" || len(r.Upcoming) != 0 {
		t.Fatalf("%+v", r)
	}
}

func TestUpcomingChangesFollowTheChosenPeriodOnly(t *testing.T) {
	// Before every period the chosen one is the next to start: it is not announced twice.
	d, l := periodFixture(t)
	applyAt(t, &d, l, "2026-03-01")
	r := d.Relations[0]
	if r.Status != "upcoming" || r.ValidFrom != "2026-04-01" || len(r.Upcoming) != 1 {
		t.Fatalf("%+v", r)
	}
	// The later row's own condition applies; a row without one keeps the listing's.
	if u := r.Upcoming[0]; u.ValidFrom != "2026-09-01" || u.Status != "active" || u.Condition != "土日のみ" || u.Hours[0] != "10-16" || u.Applies != nil {
		t.Fatalf("%+v", u)
	}
	// A past period is never shown, and after the last one nothing is upcoming.
	for _, date := range []string{"2026-07-01", "2026-11-05"} {
		d, l := periodFixture(t)
		applyAt(t, &d, l, date)
		if r := d.Relations[0]; len(r.Upcoming) != 0 {
			t.Fatalf("%s: %+v", date, r.Upcoming)
		}
	}
	d, l = periodFixture(t)
	l.Relations[0].Condition = nil
	d.Relations[0].Condition = "一覧の条件"
	applyAt(t, &d, l, "2026-03-01")
	if u := d.Relations[0].Upcoming[0]; u.Condition != "一覧の条件" {
		t.Fatalf("%+v", u)
	}
}

func TestUpcomingChangesArePublicDisplayText(t *testing.T) {
	d, l := laterPeriodFixture(t)
	l.Relations[0].MaintenanceNotes = []string{"内部メモ"}
	applyAt(t, &d, l, "2027-01-19")
	p, err := publicData(d)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(p.Relations[0].Upcoming)
	want := `[{"validFrom":"2027-01-20","status":"active","hours":["9:00～16:30","在庫がなくなり次第終了"],"applies":{"kind":"calendar","holiday":"include","weekdays":[6,7]},"condition":""}]`
	if string(b) != want {
		t.Fatalf("public upcoming: %s", b)
	}
	d.Relations[0].Upcoming[0].Hours = []string{"再確認期限は3/31"}
	if _, err := publicData(d); err == nil || !strings.Contains(err.Error(), "hours contains") {
		t.Fatalf("maintenance text in an upcoming change: %v", err)
	}
}
