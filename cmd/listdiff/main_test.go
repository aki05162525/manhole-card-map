package main

import (
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"testing"
)

func TestChangesIncludeHoursStockAndLinksWithoutRowOrderNoise(t *testing.T) {
	a := gkp.Row{ImageURL: "a.png", Place: []string{"窓口"}, Hours: []string{"9時"}, Stock: []string{"案内"}, Links: []string{"https://example.org/a"}}
	b := a
	b.Index = 99
	r, err := compare([]gkp.Row{a}, []gkp.Row{b})
	if err != nil || len(r.Changed) != 0 {
		t.Fatalf("row movement is not a change: %+v %v", r, err)
	}
	b.Hours = []string{"10時"}
	b.Stock = []string{"別の案内"}
	b.Links = []string{"https://example.org/b"}
	r, err = compare([]gkp.Row{a}, []gkp.Row{b})
	if err != nil || len(r.Changed) != 1 || len(r.Changed[0].Fields) != 3 {
		t.Fatalf("lost field changes: %+v %v", r, err)
	}
	if r.Changed[0].Before.Hours[0] != "9時" || r.Changed[0].After.Hours[0] != "10時" {
		t.Fatal("original field values lost")
	}
}

func TestAmbiguousImageIdentityFailsInsteadOfSilentlyDroppingRows(t *testing.T) {
	for _, rows := range [][]gkp.Row{{{ImageURL: ""}}, {{ImageURL: "a"}, {ImageURL: "a"}}} {
		if _, err := compare(rows, nil); err == nil {
			t.Fatal("invalid identity accepted")
		}
		if _, err := compare(nil, rows); err == nil {
			t.Fatal("invalid identity accepted")
		}
	}
}

func TestAdditionsAndRemovalsNeedIdentityReview(t *testing.T) {
	r, err := compare([]gkp.Row{{ImageURL: "old"}}, []gkp.Row{{ImageURL: "new"}})
	if err != nil || len(r.Added) != 1 || len(r.Removed) != 1 || len(r.Changed) != 0 {
		t.Fatalf("%+v %v", r, err)
	}
}
