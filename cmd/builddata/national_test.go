package main

import (
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"testing"
	"time"
)

func TestExplicitAdditionPreservesOldRelation(t *testing.T) {
	d, l := pilotFixture(t)
	l.Places = append(l.Places, LedgerPlace{ID: "facility:new", Name: "New", Address: "New address", Evidence: l.Places[0].Evidence})
	l.Relations = append(l.Relations, LedgerRelation{CardID: "card-a", PlaceID: "facility:new", SourceHash: l.Relations[0].SourceHash, Status: "active", Evidence: l.Relations[0].Evidence, Change: &RelationChange{Kind: "addition", Reason: "official relocation", PreviousPlaceIDs: []string{"place:old"}, Raw: []string{"official new address"}}})
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	if len(d.Relations) != 2 || len(d.Relations[1].Raw) == 0 {
		t.Fatal(d.Relations)
	}
	if d.Relations[1].Change.PreviousPlaceIDs[0] != "facility:one" {
		t.Fatal("history points to removed source alias", d.Relations[1].Change)
	}
	if l.Relations[1].Change.PreviousPlaceIDs[0] != "place:old" {
		t.Fatal("output normalization mutated input evidence")
	}
	if d.Places[1].Coordinate.Status == "confirmed" {
		t.Fatal("new address implicitly located")
	}
}

func TestCurrentSourceChangeInvalidatesUnregisteredCardAndLid(t *testing.T) {
	for _, hasRelation := range []bool{true, false} {
		d, _ := pilotFixture(t)
		d.Cards[0].Status = "active"
		d.Pins = []Pin{{Kind: "lid", CardIDs: []string{"card-a"}, Status: "active"}}
		if !hasRelation {
			d.Relations = nil
		}
		original := d.Cards[0]
		current := original
		current.SourceStock = []string{"一時中止"}
		d.Cards[0].ReviewSourceHash = cardSourceHash(current)
		if err := applyPlaceLedger(&d, PlaceLedger{Schema: 1}, time.Now()); err != nil {
			t.Fatal(err)
		}
		if d.Cards[0].Status != "unknown" || d.Pins[0].Status != "unknown" {
			t.Fatal("old active state survived current source change", d)
		}
		if d.Cards[0].PlaceText[0] != original.PlaceText[0] {
			t.Fatal("original text lost")
		}
	}
}

func TestCurrentSourceReapprovalUsesReviewedStatus(t *testing.T) {
	d, l := pilotFixture(t)
	d.Cards[0].Status = "active"
	current := d.Cards[0]
	current.SourceStock = []string{"一時中止"}
	d.Cards[0].ReviewSourceHash = cardSourceHash(current)
	l.Relations[0].SourceHash = d.Cards[0].ReviewSourceHash
	l.Relations[0].Status = "suspended"
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	if d.Cards[0].Status != "suspended" {
		t.Fatal("current reviewed state was lost", d.Cards[0].Status)
	}
}

func TestAdditionCannotBypassEvidenceAndHistory(t *testing.T) {
	for _, mutate := range []func(*PlaceLedger){
		func(l *PlaceLedger) { l.Relations[0].Change = nil },
		func(l *PlaceLedger) { l.Relations[0].Change.Raw = nil },
		func(l *PlaceLedger) { l.Relations[0].Change.PreviousPlaceIDs = []string{"nonexistent"} },
		func(l *PlaceLedger) { l.Relations[0].Evidence.SnapshotSHA256 = "wrong" },
		func(l *PlaceLedger) { l.Relations[0].Status = "approved" },
	} {
		d, l := pilotFixture(t)
		l.Places[0].LegacyIDs = nil
		l.Relations[0].Change = &RelationChange{Kind: "addition", Reason: "official announcement", Raw: []string{"new counter"}, PreviousPlaceIDs: []string{"place:old"}}
		mutate(&l)
		if err := applyPlaceLedger(&d, l, time.Now()); err == nil {
			t.Fatal("invalid addition accepted")
		}
	}
}

func TestReviewListInvalidatesChangedSourceWithoutReplacingRaw(t *testing.T) {
	d, l := pilotFixture(t)
	old := []gkp.Row{{ImageURL: "image", Place: d.Cards[0].PlaceText, Hours: d.Cards[0].Hours}}
	current := []gkp.Row{{ImageURL: "image", Place: []string{"new facility"}}}
	hashes, err := reviewHashes(old, current)
	if err != nil {
		t.Fatal(err)
	}
	d.Cards[0].ReviewSourceHash = hashes["image"]
	if err := applyPlaceLedger(&d, l, time.Now()); err != nil {
		t.Fatal(err)
	}
	if d.Relations[0].Review != "needs-review" || d.Cards[0].PlaceText[0] != "facility" {
		t.Fatal(d)
	}
	if _, err := reviewHashes(old, nil); err == nil {
		t.Fatal("missing current image accepted")
	}
}
