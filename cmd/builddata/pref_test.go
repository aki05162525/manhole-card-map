package main

import (
	"strings"
	"testing"
)

func TestAssignPinPrefs(t *testing.T) {
	for _, tc := range []struct {
		name, address, pref, want string
		fail                      bool
	}{
		{"address", "東京都千代田区", "大阪府", "東京都", false},
		{"card", "千代田区", "東京都", "東京都", false},
		{"missing", "千代田区", "", "", true},
		{"invalid", "千代田区", "東京", "", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := Data{Cards: []Card{{ID: "c", Pref: tc.pref}}, Places: []Place{{ID: "facility:test", Address: tc.address}}, Pins: []Pin{{ID: "facility:test", Kind: "place", CardIDs: []string{"c"}}}}
			err := assignPinPrefs(&d)
			if tc.fail {
				if err == nil || !strings.Contains(err.Error(), "facility:test") {
					t.Fatalf("error = %v", err)
				}
				return
			}
			if err != nil || d.Pins[0].Pref != tc.want {
				t.Fatalf("pin=%+v error=%v", d.Pins[0], err)
			}
		})
	}
	d := Data{Cards: []Card{{ID: "c"}}, Pins: []Pin{{Kind: "lid", CardIDs: []string{"c"}}}}
	if err := assignPinPrefs(&d); err != nil {
		t.Fatal(err)
	}
}

func TestAmbiguousPinPrefs(t *testing.T) {
	d := Data{Cards: []Card{{ID: "a", Pref: "東京都"}, {ID: "b", Pref: "大阪府"}}, Pins: []Pin{{ID: "facility:shared", Kind: "place", CardIDs: []string{"a", "b"}}}}
	if err := assignPinPrefs(&d); err == nil || !strings.Contains(err.Error(), "facility:shared") {
		t.Fatalf("error = %v", err)
	}
	d.Pins[0].Reference = true
	if err := assignPinPrefs(&d); err != nil {
		t.Fatal(err)
	}
	d.Places = []Place{{ID: "facility:shared", Address: "京都府京都市"}}
	d.Pins[0].Reference = false
	if err := assignPinPrefs(&d); err != nil || d.Pins[0].Pref != "京都府" {
		t.Fatalf("pins=%+v error=%v", d.Pins, err)
	}
}
