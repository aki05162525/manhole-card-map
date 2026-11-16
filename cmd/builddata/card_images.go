package main

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// CardImageRecord is one municipality's permission to show a card image
// (data/card-images.json). Only the path, credit and size reach the browser.
type CardImageRecord struct {
	CardID       string `json:"cardId"`
	Grantor      string `json:"grantor"`
	Credit       string `json:"credit"`
	Received     string `json:"received"`
	Terms        string `json:"terms"`
	SourceSHA256 string `json:"sourceSha256"`
	Key          string `json:"key"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
}

type CardImageRecords struct {
	Images []CardImageRecord `json:"images"`
}

// CardImage is what the detail shows: the image served by the Worker from KV.
type CardImage struct {
	Path   string `json:"path"`
	Credit string `json:"credit"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// The key names the card and a hash of the served bytes, so a URL never
// changes content (web/worker/card-images.ts accepts the same shape).
var cardImageKey = regexp.MustCompile(`^([0-9]{2}-[0-9]{3}-[A-Z][0-9]{3})-[0-9a-f]{16}\.webp$`)
var sha256Hex = regexp.MustCompile(`^[0-9a-f]{64}$`)

func applyCardImages(d *Data, records CardImageRecords) error {
	index := map[string]int{}
	for i, c := range d.Cards {
		index[c.ID] = i
	}
	seen := map[string]bool{}
	for _, r := range records.Images {
		i, ok := index[r.CardID]
		if !ok {
			return fmt.Errorf("card image for unknown card %s", r.CardID)
		}
		if seen[r.CardID] {
			return fmt.Errorf("card %s has more than one image", r.CardID)
		}
		seen[r.CardID] = true
		if m := cardImageKey.FindStringSubmatch(r.Key); m == nil || m[1] != r.CardID {
			return fmt.Errorf("card image %s: key %q must be <card ID>-<16 hex>.webp", r.CardID, r.Key)
		}
		for field, value := range map[string]string{"grantor": r.Grantor, "credit": r.Credit, "terms": r.Terms} {
			if strings.TrimSpace(value) == "" {
				return fmt.Errorf("card image %s: %s is required", r.CardID, field)
			}
		}
		if _, err := time.Parse("2006-01-02", r.Received); err != nil {
			return fmt.Errorf("card image %s: received must be YYYY-MM-DD", r.CardID)
		}
		if !sha256Hex.MatchString(r.SourceSHA256) {
			return fmt.Errorf("card image %s: sourceSha256 must be the original's SHA-256", r.CardID)
		}
		if r.Width <= 0 || r.Height <= 0 {
			return fmt.Errorf("card image %s: width and height are required", r.CardID)
		}
		d.Cards[i].Image = &CardImage{Path: "/card-images/" + r.Key, Credit: r.Credit, Width: r.Width, Height: r.Height}
	}
	return nil
}
