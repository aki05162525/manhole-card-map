package main

import (
	"fmt"
	"strings"
	"time"
)

type ExtractedExclusion struct {
	CardID                string   `json:"cardId"`
	PlaceID               string   `json:"placeId"`
	Kind                  string   `json:"kind"`
	Reason                string   `json:"reason"`
	Evidence              Evidence `json:"evidence"`
	ReplacementRelationID string   `json:"replacementRelationId,omitempty"`
}

func validateExtractedExclusions(d Data, l PlaceLedger, aliases map[string]string, now time.Time) error {
	seen := map[string]bool{}
	for _, e := range l.Exclusions {
		key := e.CardID + "\x00" + e.PlaceID
		fail := func(message string) error { return fmt.Errorf("exclusion %s / %s: %s", e.CardID, e.PlaceID, message) }
		if seen[key] {
			return fail("duplicate exclusion")
		}
		seen[key] = true
		switch e.Kind {
		case "heading", "time", "duplicate", "old-counter", "placeholder":
		default:
			return fail("invalid kind")
		}
		if strings.TrimSpace(e.Reason) == "" {
			return fail("missing reason")
		}
		if err := validateEvidence(e.Evidence); err != nil {
			return fail(err.Error())
		}
		found := false
		for _, r := range d.Relations {
			if r.CardID == e.CardID && r.PlaceID == e.PlaceID {
				found = true
			}
		}
		if !found {
			return fail("no current extracted relation")
		}
		canonical := e.PlaceID
		if a, ok := aliases[canonical]; ok {
			canonical = a
		}
		replacement := false
		for _, r := range l.Relations {
			if r.CardID == e.CardID && r.PlaceID == canonical {
				return fail("conflicts with reviewed relation")
			}
			if e.ReplacementRelationID != "" && r.ID == e.ReplacementRelationID && r.CardID == e.CardID {
				status, err := relationStatus(r, now)
				if err != nil {
					return fail(err.Error())
				}
				if (e.Kind == "old-counter" || e.Kind == "duplicate") && (r.Status == "ended" || status == "ended") {
					return fail("replacement relation has ended")
				}
				replacement = true
			}
		}
		if (e.Kind == "old-counter" || e.ReplacementRelationID != "") && !replacement {
			return fail("replacement relation of same card required")
		}
	}
	return nil
}

// Run after additions and ledger validation, before card status and pin generation.
// Excluded source IDs cannot alias a reviewed pair (validated above).
func excludeExtractedRelations(d *Data, l PlaceLedger, aliases map[string]string) error {
	excluded := map[string]string{}
	for _, e := range l.Exclusions {
		id := e.PlaceID
		if a, ok := aliases[id]; ok {
			id = a
		}
		excluded[e.CardID+"\x00"+id] = e.Kind
	}
	counts := map[string]int{"heading": 0, "time": 0, "duplicate": 0, "old-counter": 0, "placeholder": 0}
	next := []Relation{}
	remaining := map[string]bool{}
	affected := map[string]bool{}
	for _, r := range d.Relations {
		if kind, ok := excluded[r.CardID+"\x00"+r.PlaceID]; ok {
			counts[kind]++
			affected[r.CardID] = true
			continue
		}
		next = append(next, r)
		remaining[r.CardID] = true
	}
	for id := range affected {
		if !remaining[id] {
			return fmt.Errorf("exclusion leaves card without distribution places: %s", id)
		}
	}
	d.Relations = next
	d.ExcludedRelations = counts
	used := map[string]bool{}
	for _, r := range next {
		used[r.PlaceID] = true
	}
	removedPlaces := map[string]bool{}
	for key := range excluded {
		parts := strings.SplitN(key, "\x00", 2)
		removedPlaces[parts[1]] = true
	}
	places := []Place{}
	for _, p := range d.Places {
		if used[p.ID] || !removedPlaces[p.ID] {
			places = append(places, p)
		}
	}
	d.Places = places
	return nil
}
