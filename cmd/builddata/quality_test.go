package main

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestQualityReportCountsDisplayCoverage(t *testing.T) {
	lat, lng := 35.0, 139.0
	d := Data{
		Updated: "2026-10-21", EvaluatedAt: "2026-11-06",
		Cards: []Card{{ID: "a"}, {ID: "b"}, {ID: "c"}, {ID: "d"}},
		Places: []Place{
			{ID: "p1", Address: "東京都", Coordinate: Coordinate{Status: "confirmed", Lat: &lat, Lng: &lng}},
			{ID: "p2", Coordinate: Coordinate{Status: "candidate", Lat: &lat, Lng: &lng}},
		},
		Relations: []Relation{
			// a is shown at p1 only; p2 has no confirmed location.
			{CardID: "a", PlaceID: "p1", Review: "verified", Status: "active"},
			{CardID: "a", PlaceID: "p1", Review: "verified", Status: "active"},
			{CardID: "a", PlaceID: "p2", Review: "verified", Status: "active"},
			// b is not verified, so its pin does not include it.
			{CardID: "b", PlaceID: "p1", Review: "needs-review", Status: "unknown"},
			// c has no relation; d is shown at every facility.
			{CardID: "d", PlaceID: "p1", Review: "verified", Status: "suspended"},
		},
	}
	appendPlacePins(&d)
	raw, err := json.Marshal(qualityReport(d))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Updated              string         `json:"updated"`
		EvaluatedAt          string         `json:"evaluatedAt"`
		CardDisplay          map[string]int `json:"cardDisplay"`
		DisplayedPlaces      int            `json:"displayedPlaces"`
		LocatedVerifiedPairs map[string]int `json:"locatedVerifiedPairs"`
	}
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	// The counts hold on the evaluation date, not on the date the list was fetched.
	if got.Updated != "2026-10-21" || got.EvaluatedAt != "2026-11-06" {
		t.Errorf("updated = %q, evaluatedAt = %q", got.Updated, got.EvaluatedAt)
	}
	if want := map[string]int{"all": 1, "partial": 1, "none": 2}; !reflect.DeepEqual(got.CardDisplay, want) {
		t.Errorf("cardDisplay = %v, want %v", got.CardDisplay, want)
	}
	if got.DisplayedPlaces != 1 {
		t.Errorf("displayedPlaces = %d, want 1", got.DisplayedPlaces)
	}
	if want := map[string]int{"active": 1, "suspended": 1}; !reflect.DeepEqual(got.LocatedVerifiedPairs, want) {
		t.Errorf("locatedVerifiedPairs = %v, want %v", got.LocatedVerifiedPairs, want)
	}
}
