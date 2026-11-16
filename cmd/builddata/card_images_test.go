package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func permittedImage() CardImageRecord {
	return CardImageRecord{
		CardID: "14-100-B001", Grantor: "横浜市旭区役所 地域振興課", Credit: "旭区役所　地域振興課",
		Received: "2026-11-16", Terms: "クレジットを表記する", SourceSHA256: strings.Repeat("a", 64),
		Key: "14-100-B001-0123456789abcdef.webp", Width: 640, Height: 855,
	}
}

func TestCardImagesAttachOnlyToPermittedCards(t *testing.T) {
	d := Data{Cards: []Card{{ID: "14-100-B001"}, {ID: "13-100-A001"}}}
	if err := applyCardImages(&d, CardImageRecords{Images: []CardImageRecord{permittedImage()}}); err != nil {
		t.Fatal(err)
	}
	p, err := publicData(d)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(p.Cards)
	var cards []map[string]any
	if err := json.Unmarshal(b, &cards); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{"path": "/card-images/14-100-B001-0123456789abcdef.webp", "credit": "旭区役所　地域振興課", "width": 640.0, "height": 855.0}
	if got, _ := json.Marshal(cards[0]["image"]); string(got) != mustJSON(t, want) {
		t.Fatalf("permitted card image = %s", got)
	}
	// A card without a permission gets no field at all, not an empty one.
	if _, ok := cards[1]["image"]; ok {
		t.Fatalf("unpermitted card has an image: %v", cards[1])
	}
	// The permission record itself (grantor, terms, original hash) stays out of browser assets.
	for _, private := range []string{"横浜市", "クレジットを表記する", strings.Repeat("a", 64), "2026-11-16"} {
		if strings.Contains(string(b), private) {
			t.Fatalf("public cards leak %q: %s", private, b)
		}
	}
}

func TestCardImageRecordsRejectInvalidEntries(t *testing.T) {
	for name, edit := range map[string]func(*CardImageRecord){
		"unknown card":         func(r *CardImageRecord) { r.CardID = "99-999-Z999"; r.Key = "99-999-Z999-0123456789abcdef.webp" },
		"key of another card":  func(r *CardImageRecord) { r.Key = "13-100-A001-0123456789abcdef.webp" },
		"key outside the path": func(r *CardImageRecord) { r.Key = "../14-100-B001-0123456789abcdef.webp" },
		"missing credit":       func(r *CardImageRecord) { r.Credit = " " },
		"missing grantor":      func(r *CardImageRecord) { r.Grantor = "" },
		"missing terms":        func(r *CardImageRecord) { r.Terms = "" },
		"bad received date":    func(r *CardImageRecord) { r.Received = "2026/11/16" },
		"bad original hash":    func(r *CardImageRecord) { r.SourceSHA256 = "abc" },
		"no size":              func(r *CardImageRecord) { r.Height = 0 },
	} {
		t.Run(name, func(t *testing.T) {
			r := permittedImage()
			edit(&r)
			d := Data{Cards: []Card{{ID: "14-100-B001"}, {ID: "13-100-A001"}}}
			if err := applyCardImages(&d, CardImageRecords{Images: []CardImageRecord{r}}); err == nil {
				t.Fatalf("accepted %+v", r)
			}
		})
	}
	d := Data{Cards: []Card{{ID: "14-100-B001"}}}
	if err := applyCardImages(&d, CardImageRecords{Images: []CardImageRecord{permittedImage(), permittedImage()}}); err == nil {
		t.Fatal("accepted two images for one card")
	}
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}
