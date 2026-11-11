package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestLocationLifecycleWithdrawKeepsFacilityWithoutPinOrCoordinate(t *testing.T) {
	for _, status := range []string{"withdrawn"} {
		t.Run(status, func(t *testing.T) {
			d, l := pilotFixture(t)
			l.Places[0].Coordinate = nil
			l.Places[0].LocationReview = &LocationReview{Status: status, Reason: "reviewed source withdrawn", ReviewedAt: "2026-11-05"}
			now, _ := time.Parse("2006-01-02", "2026-11-05")
			if err := applyPlaceLedger(&d, l, now); err != nil {
				t.Fatal(err)
			}
			appendPlacePins(&d)
			if len(d.Places) != 1 || len(d.Pins) != 0 || d.Places[0].Coordinate.Lat != nil || d.Places[0].Coordinate.Status != "unconfirmed" {
				t.Fatal(d)
			}
			if d.Places[0].LocationReview.Status != status || d.Relations[0].Review != "verified" {
				t.Fatal(d)
			}
			full, _ := json.Marshal(d)
			details, _ := json.Marshal(map[string]any{"places": d.Places, "relations": d.Relations})
			for _, raw := range [][]byte{full, details} {
				if strings.Contains(string(raw), `"lat":35`) || !strings.Contains(string(raw), `"locationReview"`) {
					t.Fatalf("stale location or missing lifecycle metadata: %s", raw)
				}
			}
		})
	}
}

// The ledger holds a location only by adding a decision, so it never exports a pending review.
func TestLocationLifecycleRejectsPendingReview(t *testing.T) {
	for _, review := range []*LocationReview{
		{Status: "needs-review", Reason: "x"},
	} {
		d, l := pilotFixture(t)
		l.Places[0].Coordinate = nil
		l.Places[0].LocationReview = review
		if applyPlaceLedger(&d, l, time.Now()) == nil {
			t.Fatalf("pending review accepted: %+v", review)
		}
	}
}

func TestLocationLifecycleRejectsInconsistentOrUnknownMetadata(t *testing.T) {
	for _, review := range []*LocationReview{
		{Status: "bogus", Reason: "x"},
		{Status: "withdrawn", Reason: "x"},
		{Status: "confirmed", Reason: ""},
		{Status: "confirmed", Reason: "x", ReviewedAt: "tomorrow"},
	} {
		d, l := pilotFixture(t)
		l.Places[0].LocationReview = review
		if applyPlaceLedger(&d, l, time.Now()) == nil {
			t.Fatalf("invalid review accepted: %+v", review)
		}
	}
	var l PlaceLedger
	if decodeLedger([]byte(`{"schema":1,"places":[{"locationReview":{"status":"withdrawn","reason":"x","oldCoordinate":{"lat":35,"lng":139}}}],"relations":[]}`), &l) == nil {
		t.Fatal("unknown lifecycle field accepted")
	}
}

func TestLocationLifecycleFutureDecisionCannotApplyToEarlierGeneration(t *testing.T) {
	d, l := pilotFixture(t)
	l.Places[0].LocationReview = &LocationReview{Status: "confirmed", Reason: "reviewed", ReviewedAt: "2026-11-06"}
	now, _ := time.Parse("2006-01-02", "2026-11-05")
	if applyPlaceLedger(&d, l, now) == nil {
		t.Fatal("future review applied to historical build")
	}
}
