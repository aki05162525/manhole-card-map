package main

import (
	"fmt"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"strings"
)

// Review current distribution fields by exact image identity, never row index.
// Additions/removals require an explicit identity migration before this build.
func reviewHashes(before, current []gkp.Row) (map[string]string, error) {
	next := map[string]gkp.Row{}
	out := map[string]string{}
	for _, r := range current {
		if strings.TrimSpace(r.ImageURL) == "" {
			return nil, fmt.Errorf("empty current image")
		}
		if _, ok := next[r.ImageURL]; ok {
			return nil, fmt.Errorf("duplicate current image %s", r.ImageURL)
		}
		next[r.ImageURL] = r
	}
	for _, r := range before {
		if _, ok := out[r.ImageURL]; ok {
			return nil, fmt.Errorf("duplicate baseline image %s", r.ImageURL)
		}
		n, ok := next[r.ImageURL]
		if !ok {
			return nil, fmt.Errorf("current image absent; reconcile printed identity first: %s", r.ImageURL)
		}
		out[r.ImageURL] = cardSourceHash(Card{PlaceText: n.Place, Hours: n.Hours, SourceStock: n.Stock, Links: n.Links})
	}
	if len(next) != len(out) {
		return nil, fmt.Errorf("current list contains new images; reconcile printed identities first")
	}
	return out, nil
}
