package main

import (
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"testing"
)

func TestRejectShiftedSourceIndex(t *testing.T) {
	row := gkp.Row{ImageURL: "https://example.jp/a.jpg", Place: []string{"施設", "東京都千代田区1-2", "電話：03-1234-5678"}}
	if err := validateOCRIdentity(row, card{Image: "b.jpg"}); err == nil {
		t.Fatal("shifted image accepted")
	}
	s := source{Place: 0, Name: "施設", Original: "東京都千代田区1-2"}
	if err := validateAddressSource(row, s); err != nil {
		t.Fatal(err)
	}
	s.Original = "旧住所"
	if err := validateAddressSource(row, s); err == nil {
		t.Fatal("stale address accepted")
	}
}

func TestAddressSourceAcceptsExactSplitAddressesOnly(t *testing.T) {
	row := gkp.Row{Place: []string{"施設", "東京都千代田区1-2", "東京都千代田区3-4"}}
	ps := gkp.ParsePlaces(row.Place).Places
	if len(ps) != 1 || ps[0].Address != "東京都千代田区1-2 / 東京都千代田区3-4" {
		t.Fatal(ps)
	}
	for _, address := range []string{"東京都千代田区1-2", "東京都千代田区3-4"} {
		if err := validateAddressSource(row, source{Place: 0, Name: "施設", Original: address}); err != nil {
			t.Fatal(err)
		}
	}
	for _, address := range []string{"東京都千代田区1", "東京都千代田区5-6", ""} {
		if validateAddressSource(row, source{Place: 0, Name: "施設", Original: address}) == nil {
			t.Fatal("invalid split address accepted", address)
		}
	}
}
