package main

import (
	"bytes"
	"encoding/json"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestIncompleteCoordinateCannotBecomeConfirmedZero(t *testing.T) {
	for _, coordinate := range []string{`{}`} {
		var ledger PlaceLedger
		if err := decodeLedger([]byte(`{"schema":1,"places":[{"coordinate":`+coordinate+`}]}`), &ledger); err == nil {
			t.Fatalf("incomplete coordinate accepted: %s", coordinate)
		}
	}
	var ledger PlaceLedger
	if err := decodeLedger([]byte(`{"schema":1,"places":[{"coordinate":{"lat":0,"lng":0}},{"coordinate":null},{}]}`), &ledger); err != nil {
		t.Fatal(err)
	}
}

func pilotFixture(t *testing.T) (Data, PlaceLedger) {
	t.Helper()
	ev := Evidence{SourceURL: "https://example.gov.jp/card", SnapshotSHA256: hash([]byte("official evidence")), SourceLocator: "distribution and map", CheckedAt: "2026-11-05", ActorType: "ai", VerificationMethod: "official facility map coordinates and distribution notice checked"}
	d := Data{Cards: []Card{{ID: "card-a", PlaceText: []string{"facility"}, Hours: []string{"9-17"}}}, Places: []Place{{ID: "place:old", Name: "old"}}, Relations: []Relation{{CardID: "card-a", PlaceID: "place:old"}}}
	l := PlaceLedger{Schema: 1, Places: []LedgerPlace{{ID: "facility:one", LegacyIDs: []string{"place:old"}, Name: "facility", Address: "address", Coordinate: &LedgerCoordinate{Lat: 35, Lng: 139}, Evidence: ev}}, Relations: []LedgerRelation{{CardID: "card-a", PlaceID: "facility:one", SourceHash: cardSourceHash(d.Cards[0]), Hours: []string{"9-17"}, Status: "active", Evidence: ev}}}
	return d, l
}
func TestLedgerApprovedPlacePinAndStableIdentity(t *testing.T) {
	d, l := pilotFixture(t)
	now, _ := time.Parse("2006-01-02", "2026-11-05")
	if err := applyPlaceLedger(&d, l, now); err != nil {
		t.Fatal(err)
	}
	appendPlacePins(&d, false)
	if len(d.Pins) != 1 || d.Pins[0].ID != "facility:one" || d.Pins[0].Reference {
		t.Fatalf("%+v", d.Pins)
	}
	if d.Relations[0].Review != "verified" || d.Relations[0].Hours[0] != "9-17" {
		t.Fatal(d.Relations)
	}
}
func TestLedgerSourceChangeRequiresReview(t *testing.T) {
	d, l := pilotFixture(t)
	d.Cards[0].Hours = []string{"changed"}
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	appendPlacePins(&d, false)
	if len(d.Pins) != 0 || d.Relations[0].Review != "needs-review" || d.Relations[0].Status != "unknown" {
		t.Fatal(d)
	}
}
func TestLedgerRejectsInvalidEvidenceAndReferences(t *testing.T) {
	for _, change := range []func(*PlaceLedger){
		func(l *PlaceLedger) { l.Places[0].Coordinate.Lat = 100 },
		func(l *PlaceLedger) { l.Places[0].Evidence.SourceURL = "javascript:alert(1)" },
		func(l *PlaceLedger) { l.Places[0].Evidence.SnapshotSHA256 = "wrong" },
		func(l *PlaceLedger) { l.Relations[0].CardID = "missing" },
		func(l *PlaceLedger) { l.Relations[0].Status = "bogus" },
		func(l *PlaceLedger) { l.Relations[0].ValidFrom = "wrong" },
	} {
		d, l := pilotFixture(t)
		change(&l)
		if applyPlaceLedger(&d, l, time.Now()) == nil {
			t.Fatal("invalid ledger accepted")
		}
	}
}

// Snapshots are removed once reviewed (Issue #237): the ledger keeps their digests only.
func TestLedgerEvidenceNeedsNoSnapshotFile(t *testing.T) {
	for _, path := range []string{"", filepath.Join(t.TempDir(), "removed.html")} {
		d, l := pilotFixture(t)
		l.Places[0].Evidence.SnapshotPath = path
		l.Relations[0].Evidence.SnapshotPath = path
		if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
			t.Fatalf("snapshot path %q: %v", path, err)
		}
	}
}
func TestLedgerRejectsMalformedSnapshotDigest(t *testing.T) {
	valid := hash([]byte("official evidence"))
	for _, digest := range []string{"", "wrong", valid[:63], valid + "0", strings.ToUpper(valid), "g" + valid[1:]} {
		d, l := pilotFixture(t)
		l.Relations[0].Evidence.SnapshotSHA256 = digest
		if applyPlaceLedger(&d, l, time.Now()) == nil {
			t.Fatalf("snapshot digest accepted: %q", digest)
		}
	}
}
func TestLedgerFutureAndExpiredWindows(t *testing.T) {
	for _, tc := range []struct{ from, to, want string }{{"2026-12-01", "", "upcoming"}, {"", "2026-10-01", "ended"}} {
		d, l := pilotFixture(t)
		l.Relations[0].ValidFrom = tc.from
		l.Relations[0].ValidTo = tc.to
		now, _ := time.Parse("2006-01-02", "2026-11-05")
		if err := applyPlaceLedger(&d, l, now); err != nil {
			t.Fatal(err)
		}
		if d.Relations[0].Status != tc.want {
			t.Fatal(d.Relations)
		}
	}
}

func TestHistoricalAliasesSurviveSourceCorrections(t *testing.T) {
	d, l := pilotFixture(t)
	d.Places[0].ID = "place:corrected"
	d.Relations[0].PlaceID = "place:corrected"
	l.Places[0].LegacyIDs = append(l.Places[0].LegacyIDs, "place:corrected")
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	if d.Places[0].ID != "facility:one" {
		t.Fatal(d.Places)
	}
}
func TestSharedFacilityPinIncludesOnlyReviewedCards(t *testing.T) {
	d, l := pilotFixture(t)
	d.Cards = append(d.Cards, Card{ID: "unreviewed"})
	d.Relations = append(d.Relations, Relation{CardID: "unreviewed", PlaceID: "place:old"})
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	appendPlacePins(&d, false)
	if len(d.Pins) != 1 || len(d.Pins[0].CardIDs) != 1 || d.Pins[0].CardIDs[0] != "card-a" {
		t.Fatal(d.Pins)
	}
}
func TestPartialClosureDoesNotEndWholeCard(t *testing.T) {
	now, _ := time.Parse("2006-01-02", "2026-11-05")
	if got := distribution(gkp.Row{Place: []string{"東京都庁（東京都新宿区西新宿2-8-1）", "追加2施設は配布終了"}}, now); got == "ended" {
		t.Fatal(got)
	}
}

func TestLedgerLinksAndStockChangesRequireReview(t *testing.T) {
	for _, change := range []func(*Card){func(c *Card) { c.SourceStock = []string{"在庫切れ"} }, func(c *Card) { c.Links = []string{"https://example.gov.jp/new"} }} {
		d, l := pilotFixture(t)
		change(&d.Cards[0])
		if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
			t.Fatal(err)
		}
		appendPlacePins(&d, false)
		if len(d.Pins) != 0 || d.Relations[0].Review != "needs-review" {
			t.Fatal(d)
		}
	}
}

// CI validates the provenance of the ledger exported from data/db. The full build
// (TestManifestDoesNotDependOnLedgerLocation) additionally matches it to the source list.
func TestCheckedInLedgerEvidence(t *testing.T) {
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	raw := exportLedger(t, root, filepath.Join(t.TempDir(), "ledger.json"))
	var l PlaceLedger
	if err := decodeLedger(raw, &l); err != nil {
		t.Fatal(err)
	}
	if l.Schema != 1 {
		t.Fatal("unsupported ledger schema")
	}
	evidence := []Evidence{}
	for _, p := range l.Places {
		evidence = append(evidence, p.Evidence)
	}
	for _, r := range l.Relations {
		evidence = append(evidence, r.Evidence)
		if _, err := relationStatus(r, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	for _, e := range evidence {
		if err := validateEvidence(e); err != nil {
			t.Fatal(err)
		}
	}
}

func TestReviewedPartialClosurePreservesActiveCard(t *testing.T) {
	d, l := pilotFixture(t)
	d.Places = append(d.Places, Place{ID: "place:second"})
	d.Relations = append(d.Relations, Relation{CardID: "card-a", PlaceID: "place:second"})
	p := l.Places[0]
	p.ID = "facility:two"
	p.LegacyIDs = []string{"place:second"}
	l.Places = append(l.Places, p)
	r := l.Relations[0]
	r.PlaceID = "facility:two"
	r.Status = "ended"
	l.Relations = append(l.Relations, r)
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	if d.Cards[0].Status != "active" {
		t.Fatal(d.Cards)
	}
}

func TestMaintenanceNotesSurviveReviewAndStayPrivate(t *testing.T) {
	for _, stale := range []bool{false, true} {
		d, l := pilotFixture(t)
		raw, err := json.Marshal(l)
		if err != nil {
			t.Fatal(err)
		}
		var ledger map[string]any
		if err := json.Unmarshal(raw, &ledger); err != nil {
			t.Fatal(err)
		}
		notes := []string{"旧入力を訂正。GKPとの照合根拠を保持。"}
		ledger["relations"].([]any)[0].(map[string]any)["maintenanceNotes"] = notes
		raw, err = json.Marshal(ledger)
		if err != nil {
			t.Fatal(err)
		}
		if err := decodeLedger(raw, &l); err != nil {
			t.Fatal(err)
		}
		if stale {
			l.Relations[0].SourceHash = strings.Repeat("0", 64)
		}
		if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
			t.Fatal(err)
		}
		raw, err = json.Marshal(d)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Contains(raw, []byte(notes[0])) {
			t.Fatal("lost internal maintenance notes")
		}
		p, err := publicData(d)
		if err != nil {
			t.Fatal(err)
		}
		raw, err = json.Marshal(p)
		if err != nil {
			t.Fatal(err)
		}
		if bytes.Contains(raw, []byte("maintenanceNotes")) || bytes.Contains(raw, []byte(notes[0])) {
			t.Fatal("published maintenance notes")
		}
	}
}

func TestVerifiedConditionOverridesOriginalButStaleDoesNot(t *testing.T) {
	for _, stale := range []bool{false, true} {
		d, l := pilotFixture(t)
		d.Relations[0].Condition = "土日"
		condition := "土日祝日"
		l.Relations[0].Condition = &condition
		if stale {
			d.Cards[0].SourceStock = []string{"changed"}
		}
		if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
			t.Fatal(err)
		}
		want := "土日祝日"
		if stale {
			want = "土日"
		}
		if d.Relations[0].Condition != want {
			t.Fatal(d.Relations)
		}
	}
}

func TestReviewedStatusDoesNotRequireFacilityCoordinates(t *testing.T) {
	d, l := pilotFixture(t)
	l.Places[0].Coordinate = nil
	l.Relations[0].Status = "suspended"
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	appendPlacePins(&d, false)
	if len(d.Pins) != 0 || d.Places[0].Coordinate.Status != "unconfirmed" || d.Places[0].Coordinate.Lat != nil {
		t.Fatal(d)
	}
	if d.Relations[0].Review != "verified" || d.Relations[0].Status != "suspended" || d.Cards[0].Status != "suspended" {
		t.Fatal(d)
	}
}

func TestExpiredReviewDoesNotTurnSuspensionIntoEndOrActive(t *testing.T) {
	for _, tc := range []struct{ date, review, status string }{{"2027-01-04", "verified", "suspended"}, {"2027-01-05", "needs-review", "unknown"}} {
		d, l := pilotFixture(t)
		d.Cards[0].Status = "active"
		l.Relations[0].Status = "suspended"
		l.Relations[0].ReviewUntil = "2027-01-04"
		now, _ := time.Parse("2006-01-02", tc.date)
		if err := applyPlaceLedger(&d, l, now); err != nil {
			t.Fatal(err)
		}
		if d.Relations[0].Review != tc.review || d.Relations[0].Status != tc.status || d.Cards[0].Status != tc.status {
			t.Fatal(d)
		}
		if tc.status == "unknown" {
			appendPlacePins(&d, false)
			if len(d.Pins) != 0 {
				t.Fatal(d.Pins)
			}
		}
	}
}
