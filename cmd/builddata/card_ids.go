package main

import (
	"fmt"
	"sort"
	"strings"
)

// IDs is append-only publication history; retired IDs remain reserved forever.
type CardIDRegistry struct {
	IDs      []string          `json:"ids"`
	Aliases  map[string]string `json:"aliases"`
	Excluded map[string]string `json:"excluded"`
}

func (r *CardIDRegistry) add(current []string) {
	seen := map[string]bool{}
	for _, id := range r.IDs {
		seen[id] = true
	}
	for _, id := range current {
		if !seen[id] {
			r.IDs = append(r.IDs, id)
			seen[id] = true
		}
	}
	sort.Strings(r.IDs)
}

func (r CardIDRegistry) validate(current []string) error {
	known, active := map[string]bool{}, map[string]bool{}
	for _, id := range r.IDs {
		if strings.TrimSpace(id) == "" {
			return fmt.Errorf("empty card ID")
		}
		if known[id] {
			return fmt.Errorf("duplicate card ID %s", id)
		}
		known[id] = true
	}
	for _, id := range current {
		if active[id] {
			return fmt.Errorf("duplicate generated card ID %s", id)
		}
		active[id] = true
	}
	for old, target := range r.Aliases {
		if !known[old] || !known[target] {
			return fmt.Errorf("unregistered alias %s -> %s", old, target)
		}
		if _, ok := r.Excluded[old]; ok {
			return fmt.Errorf("card ID %s is both alias and excluded", old)
		}
		if _, ok := r.Aliases[target]; ok {
			return fmt.Errorf("alias chain or cycle %s -> %s", old, target)
		}
		if !active[target] {
			return fmt.Errorf("alias target missing: %s -> %s", old, target)
		}
		if active[old] {
			return fmt.Errorf("retired alias ID reused: %s", old)
		}
	}
	for id, reason := range r.Excluded {
		if !known[id] {
			return fmt.Errorf("unregistered excluded card ID %s", id)
		}
		if strings.TrimSpace(reason) == "" {
			return fmt.Errorf("excluded card ID %s needs a reason", id)
		}
		if active[id] {
			return fmt.Errorf("excluded card ID reused: %s", id)
		}
	}
	for _, id := range r.IDs {
		_, alias := r.Aliases[id]
		_, excluded := r.Excluded[id]
		if !active[id] && !alias && !excluded {
			return fmt.Errorf("card ID disappeared without alias or exclusion: %s", id)
		}
	}
	for _, id := range current {
		if !known[id] {
			return fmt.Errorf("new card ID %s: add with -update-card-ids and review the registry diff", id)
		}
	}
	return nil
}
