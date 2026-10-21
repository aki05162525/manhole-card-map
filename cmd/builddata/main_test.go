package main

import (
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"testing"
	"time"
)

func TestUncertainPlacesNeverBecomeConfirmed(t *testing.T) {
	lat, lng := 35.0, 139.0
	c := Check{Lat: &lat, Lng: &lng, CoordinateLevel: "residential_detail"}
	c.Source = &struct {
		Place    int  `json:"place"`
		Borrowed bool `json:"borrowed"`
	}{}
	c.ByName.Status = "一致"
	if got := placeCoordinate(c); got.Status != "candidate" {
		t.Fatal(got)
	}
	c.Source.Borrowed = true
	if got := placeCoordinate(c); got.Status != "unconfirmed" || got.Lat != nil {
		t.Fatal(got)
	}
	c.Source.Borrowed = false
	c.CoordinateLevel = "city"
	if got := placeCoordinate(c); got.Status != "unconfirmed" {
		t.Fatal(got)
	}
	c.CoordinateLevel = "residential_detail"
	c.ByName.Status = "不一致"
	if got := placeCoordinate(c); got.Status != "unconfirmed" {
		t.Fatal(got)
	}
}
func TestStatuses(t *testing.T) {
	date, _ := time.Parse("2006-01-02", "2026-10-21")
	for _, tt := range []struct{ text, issued, want string }{{"施設", "2026/12/01", "upcoming"}, {"配布終了", "2026/01/01", "ended"}, {"一時中止", "2026/01/01", "suspended"}, {"施設", "2026/01/01", "active"}, {"配布終了。配布再開", "2026/01/01", "unknown"}, {"配布開始予定", "", "upcoming"}} {
		if got := distribution(gkp.Row{Place: []string{tt.text}, Issued: tt.issued}, date); got != tt.want {
			t.Errorf("%s: %s", tt.text, got)
		}
	}
}
