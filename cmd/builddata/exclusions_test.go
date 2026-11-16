package main

import (
	"testing"
	"time"
)

func TestExtractedExclusions(t *testing.T) {
	for _, scenario := range []string{"remove", "stale", "last", "replacement", "wrong-card", "reviewed", "duplicate"} {
		t.Run(scenario, func(t *testing.T) {
			d, l := pilotFixture(t)
			l.Relations[0].ID = "relation:one"
			d.Places = append(d.Places, Place{ID: "place:heading"})
			d.Relations = append(d.Relations, Relation{CardID: "card-a", PlaceID: "place:heading"}, Relation{CardID: "card-a", PlaceID: "place:heading"})
			l.Exclusions = []ExtractedExclusion{{CardID: "card-a", PlaceID: "place:heading", Kind: "heading", Reason: "building heading", Evidence: l.Places[0].Evidence}}
			switch scenario {
			case "stale":
				l.Exclusions[0].PlaceID = "place:absent"
			case "last":
				l.Places = nil
				l.Relations = nil
				d.Relations = d.Relations[1:]
			case "replacement":
				l.Exclusions[0].Kind = "old-counter"
			case "wrong-card":
				l.Exclusions[0].Kind = "old-counter"
				l.Exclusions[0].ReplacementRelationID = "missing"
			case "reviewed":
				l.Exclusions[0].PlaceID = "place:old"
			case "duplicate":
				l.Exclusions = append(l.Exclusions, l.Exclusions[0])
			}
			err := applyPlaceLedger(&d, l, time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC))
			if scenario != "remove" {
				if err == nil {
					t.Fatal("unsafe exclusion accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if len(d.Relations) != 1 || len(d.Places) != 1 {
				t.Fatalf("relations/places: %d/%d", len(d.Relations), len(d.Places))
			}
			q := qualityReport(d).(map[string]any)
			if q["excludedRelations"].(map[string]int)["heading"] != 2 {
				t.Fatal(q)
			}
		})
	}
}

func TestOldCounterReplacementAndSharedExtractedPlace(t *testing.T) {
	d, l := pilotFixture(t)
	l.Relations[0].ID = "replacement"
	d.Cards = append(d.Cards, Card{ID: "card-b"})
	d.Places = append(d.Places, Place{ID: "place:shared"})
	d.Relations = append(d.Relations, Relation{CardID: "card-a", PlaceID: "place:shared"}, Relation{CardID: "card-b", PlaceID: "place:shared"})
	l.Exclusions = []ExtractedExclusion{{CardID: "card-a", PlaceID: "place:shared", Kind: "old-counter", Reason: "relocated", ReplacementRelationID: "replacement", Evidence: l.Places[0].Evidence}}
	if err := applyPlaceLedger(&d, l, time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	if len(d.Relations) != 2 || d.Relations[1].CardID != "card-b" || len(d.Places) != 2 {
		t.Fatal("another card's counter was removed")
	}
}
