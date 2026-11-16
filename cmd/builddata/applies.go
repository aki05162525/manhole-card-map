package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Switch only after every multi-counter relation (including period rows) is curated.
const requireMultipleApplies = false
const maxAppliesDepth = 32

type AnnualRange struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Applies contains only public fields; decoding rejects keys belonging to other kinds.
type Applies struct {
	Kind     string       `json:"kind"`
	Weekdays []int        `json:"weekdays,omitempty"`
	Holiday  string       `json:"holiday,omitempty"`
	Season   *AnnualRange `json:"season,omitempty"`
	From     string       `json:"from,omitempty"`
	To       string       `json:"to,omitempty"`
	PlaceID  string       `json:"placeId,omitempty"`
	Closure  string       `json:"closure,omitempty"`
	Label    string       `json:"label,omitempty"`
	Items    []*Applies   `json:"items,omitempty"`
	Base     *Applies     `json:"base,omitempty"`
	Excluded *Applies     `json:"excluded,omitempty"`
}

func (a Applies) MarshalJSON() ([]byte, error) {
	type plain Applies
	if a.Kind == "calendar" {
		return json.Marshal(struct {
			plain
			Weekdays []int `json:"weekdays"`
		}{plain(a), append([]int{}, a.Weekdays...)})
	}
	return json.Marshal(plain(a))
}
func (a *Applies) UnmarshalJSON(raw []byte) error {
	parsed, err := decodeApplies(raw, 0)
	if err == nil {
		*a = *parsed
	}
	return err
}
func decodeApplies(raw []byte, depth int) (*Applies, error) {
	if depth >= maxAppliesDepth {
		return nil, fmt.Errorf("applies exceeds depth %d", maxAppliesDepth)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil || fields == nil {
		return nil, fmt.Errorf("applies must be an object")
	}
	var kind string
	if err := json.Unmarshal(fields["kind"], &kind); err != nil {
		return nil, fmt.Errorf("applies requires kind")
	}
	required := map[string][]string{
		"openDays": {}, "calendar": {"weekdays", "holiday"}, "annual": {"from", "to"},
		"closedDayOf": {"placeId", "closure"}, "text": {"label"}, "all": {"items"}, "any": {"items"}, "except": {"base", "excluded"},
	}
	keys, ok := required[kind]
	if !ok {
		return nil, fmt.Errorf("unknown applies kind %q", kind)
	}
	allowed := map[string]bool{"kind": true}
	for _, key := range keys {
		allowed[key] = true
		if len(fields[key]) == 0 || string(fields[key]) == "null" {
			return nil, fmt.Errorf("applies %s requires %s", kind, key)
		}
	}
	if kind == "calendar" {
		allowed["season"] = true
	}
	for key, value := range fields {
		if !allowed[key] || string(value) == "null" {
			return nil, fmt.Errorf("applies %s forbids %s or null", kind, key)
		}
	}
	a := &Applies{Kind: kind}
	// Decode scalar fields separately so recursion always carries the depth budget.
	scalar := map[string]any{"weekdays": &a.Weekdays, "holiday": &a.Holiday, "from": &a.From, "to": &a.To, "placeId": &a.PlaceID, "closure": &a.Closure, "label": &a.Label}
	for key, target := range scalar {
		if value, ok := fields[key]; ok {
			if err := json.Unmarshal(value, target); err != nil {
				return nil, fmt.Errorf("applies %s: %w", key, err)
			}
		}
	}
	validRange := func(from, to string) bool {
		for _, s := range []string{from, to} {
			if len(s) != 5 {
				return false
			}
			if _, err := time.Parse("2006-01-02", "2000-"+s); err != nil {
				return false
			}
		}
		return true
	}
	if rawSeason, ok := fields["season"]; ok {
		var s map[string]string
		if err := json.Unmarshal(rawSeason, &s); err != nil || len(s) != 2 || !validRange(s["from"], s["to"]) {
			return nil, fmt.Errorf("invalid applies season")
		}
		a.Season = &AnnualRange{s["from"], s["to"]}
	}
	switch kind {
	case "calendar":
		if a.Holiday != "include" && a.Holiday != "exclude" && a.Holiday != "asWeekday" {
			return nil, fmt.Errorf("invalid holiday")
		}
		if len(a.Weekdays) == 0 && a.Holiday != "include" {
			return nil, fmt.Errorf("empty calendar")
		}
		seen := map[int]bool{}
		for _, day := range a.Weekdays {
			if day < 1 || day > 7 || seen[day] {
				return nil, fmt.Errorf("invalid or duplicate weekday")
			}
			seen[day] = true
		}
	case "annual":
		if !validRange(a.From, a.To) {
			return nil, fmt.Errorf("invalid annual range")
		}
	case "closedDayOf":
		if strings.TrimSpace(a.PlaceID) == "" || (a.Closure != "all" && a.Closure != "regular" && a.Closure != "temporary") {
			return nil, fmt.Errorf("invalid closure reference")
		}
	case "text":
		if strings.TrimSpace(a.Label) == "" {
			return nil, fmt.Errorf("empty applies label")
		}
		if err := validatePublicCondition(Relation{Condition: a.Label}); err != nil {
			return nil, err
		}
	case "all", "any":
		var items []json.RawMessage
		if err := json.Unmarshal(fields["items"], &items); err != nil || len(items) < 2 {
			return nil, fmt.Errorf("applies items requires at least two terms")
		}
		for _, item := range items {
			child, err := decodeApplies(item, depth+1)
			if err != nil {
				return nil, err
			}
			a.Items = append(a.Items, child)
		}
	case "except":
		var err error
		a.Base, err = decodeApplies(fields["base"], depth+1)
		if err != nil {
			return nil, err
		}
		a.Excluded, err = decodeApplies(fields["excluded"], depth+1)
		if err != nil {
			return nil, err
		}
	}
	return a, nil
}

func walkApplies(a *Applies, visit func(*Applies) error) error {
	if a == nil {
		return nil
	}
	if err := visit(a); err != nil {
		return err
	}
	for _, child := range append(append([]*Applies{}, a.Items...), a.Base, a.Excluded) {
		if err := walkApplies(child, visit); err != nil {
			return err
		}
	}
	return nil
}

func validateLedgerApplies(rows []LedgerRelation, required bool) error {
	facilities := map[string]map[string]bool{}
	for _, r := range rows {
		if facilities[r.CardID] == nil {
			facilities[r.CardID] = map[string]bool{}
		}
		facilities[r.CardID][r.PlaceID] = true
	}
	for _, r := range rows {
		if required && len(facilities[r.CardID]) > 1 && r.Applies == nil {
			return fmt.Errorf("relation %s/%s: missing applies", r.CardID, r.PlaceID)
		}
		err := walkApplies(r.Applies, func(a *Applies) error {
			if a.Kind != "closedDayOf" {
				return nil
			}
			if a.PlaceID == r.PlaceID {
				return fmt.Errorf("closedDayOf self reference")
			}
			// The target's period rows must cover the entire referring interval.
			var targets []LedgerRelation
			for _, target := range rows {
				if target.CardID == r.CardID && target.PlaceID == a.PlaceID {
					targets = append(targets, target)
				}
			}
			sort.Slice(targets, func(i, j int) bool { return targets[i].ValidFrom < targets[j].ValidFrom })
			cursor := r.ValidFrom
			for _, target := range targets {
				if target.ValidTo != "" && target.ValidTo < cursor {
					continue
				}
				if target.ValidFrom > cursor {
					break
				}
				if target.ValidTo == "" || (r.ValidTo != "" && target.ValidTo >= r.ValidTo) {
					return nil
				}
				end, err := time.Parse("2006-01-02", target.ValidTo)
				if err != nil {
					return err
				}
				cursor = end.AddDate(0, 0, 1).Format("2006-01-02")
			}
			return fmt.Errorf("closedDayOf %s has no same-card counter covering the relation period", a.PlaceID)
		})
		if err != nil {
			return fmt.Errorf("relation %s/%s applies: %w", r.CardID, r.PlaceID, err)
		}
	}
	return nil
}

func appliesQuality(rows []Relation) map[string]map[string]int {
	q := map[string]map[string]int{}
	for _, key := range []string{"missing", "text", "calendarUnevaluated"} {
		q[key] = map[string]int{"total": 0, "multiple": 0, "single": 0}
	}
	facilities := map[string]map[string]bool{}
	for _, r := range rows {
		if facilities[r.CardID] == nil {
			facilities[r.CardID] = map[string]bool{}
		}
		facilities[r.CardID][r.PlaceID] = true
	}
	for _, r := range rows {
		group := "single"
		if len(facilities[r.CardID]) > 1 {
			group = "multiple"
		}
		flags := map[string]bool{"missing": r.Applies == nil}
		_ = walkApplies(r.Applies, func(a *Applies) error {
			if a.Kind == "text" {
				flags["text"] = true
			}
			if a.Kind == "openDays" || a.Kind == "closedDayOf" {
				flags["calendarUnevaluated"] = true
			}
			return nil
		})
		for key, yes := range flags {
			if yes {
				q[key]["total"]++
				q[key][group]++
			}
		}
	}
	return q
}
