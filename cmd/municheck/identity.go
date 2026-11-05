package main

import (
	"fmt"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"net/url"
	"path"
	"slices"
	"strings"
)

func validateOCRIdentity(row gkp.Row, c card) error {
	u, err := url.Parse(strings.TrimSpace(row.ImageURL))
	if err != nil {
		return err
	}
	name := strings.TrimRight(path.Base(u.Path), ".")
	if path.Ext(name) == "" {
		name += ".jpg"
	}
	if name != c.Image {
		return fmt.Errorf("OCR/list identity mismatch at row %d: %s / %s; regenerate index-bound inputs", row.Index, c.Image, row.ImageURL)
	}
	return nil
}
func validateAddressSource(row gkp.Row, s source) error {
	ps := gkp.ParsePlaces(row.Place).Places
	if s.Place < 0 || s.Place >= len(ps) {
		return fmt.Errorf("address source place index out of range: %d/%d", s.Index, s.Place)
	}
	p := ps[s.Place]
	// addresses splits multiple addresses before recording each source.
	addressMatches := s.Original != "" && slices.Contains(strings.Split(p.Address, " / "), s.Original)
	if p.Name != s.Name || !addressMatches || p.Condition != s.Condition || (p.AddressFrom != nil) != s.Borrowed {
		return fmt.Errorf("address source changed at %d/%d; regenerate sources and geocoding", s.Index, s.Place)
	}
	return nil
}
