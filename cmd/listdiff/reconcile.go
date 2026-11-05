package main

import (
	"fmt"
	"github.com/aki05162525/manhole-card-map/internal/gkp"
	"net/url"
	"path"
	"sort"
	"strings"
)

type identityCheck struct {
	Kind  string `json:"kind"`
	Image string `json:"image"`
	Code  string `json:"code"`
}
type localCard struct {
	ID string `json:"id"`
}
type identityRow struct {
	ImageURL         string       `json:"imageUrl"`
	PrintedID        string       `json:"adoptedPrintedCardId"`
	CurrentDerivedID string       `json:"currentDerivedId"`
	CurrentIDSource  gkp.IDSource `json:"currentIdSource"`
	Present          bool         `json:"presentInCurrentList"`
	IndexChanged     bool         `json:"indexChanged"`
	Issues           []string     `json:"issues"`
}
type reconciliation struct {
	Rows             []identityRow `json:"rows"`
	MissingLocal     []string      `json:"printedIdsMissingLocally"`
	ExtraLocal       []string      `json:"localIdsMissingFromBaseline"`
	CurrentUnmatched []gkp.Row     `json:"currentImagesWithoutPrintedId"`
}

func imageName(s string) string {
	u, e := url.Parse(strings.TrimSpace(s))
	if e != nil {
		return ""
	}
	name := strings.TrimRight(path.Base(u.Path), ".")
	if path.Ext(name) == "" {
		name += ".jpg"
	}
	return name
}
func reconcile(before, after []gkp.Row, checks []identityCheck, local []localCard) (reconciliation, error) {
	out := reconciliation{Rows: []identityRow{}, MissingLocal: []string{}, ExtraLocal: []string{}, CurrentUnmatched: []gkp.Row{}}
	printed := map[string]string{}
	codes := map[string]bool{}
	for _, c := range checks {
		if c.Kind != "lid" {
			continue
		}
		if c.Code == "" || printed[c.Image] != "" || codes[c.Code] {
			return out, fmt.Errorf("missing/duplicate printed identity: %s / %s", c.Image, c.Code)
		}
		printed[c.Image] = c.Code
		codes[c.Code] = true
	}
	locals := map[string]bool{}
	for _, c := range local {
		if c.ID == "" || locals[c.ID] {
			return out, fmt.Errorf("missing/duplicate local card ID: %s", c.ID)
		}
		locals[c.ID] = true
	}
	current, err := index(after)
	if err != nil {
		return out, err
	}
	baseline, err := index(before)
	if err != nil {
		return out, err
	}
	names := map[string]bool{}
	used := map[string]bool{}
	for _, old := range before {
		name := imageName(old.ImageURL)
		if names[name] {
			return out, fmt.Errorf("ambiguous image basename %s", name)
		}
		names[name] = true
		id := printed[name]
		if id == "" {
			return out, fmt.Errorf("no adopted printed ID for %s", old.ImageURL)
		}
		used[id] = true
		row := identityRow{ImageURL: old.ImageURL, PrintedID: id, Issues: []string{}}
		if now, ok := current[old.ImageURL]; ok {
			row.Present = true
			row.IndexChanged = old.Index != now.Index
			row.CurrentDerivedID, row.CurrentIDSource = gkp.CardID(now)
			if row.CurrentDerivedID != id {
				row.Issues = append(row.Issues, "derived ID differs from adopted printed ID; manual review required")
			}
		} else {
			row.Issues = append(row.Issues, "image absent from current list; removal or image replacement unresolved")
		}
		if !locals[id] {
			out.MissingLocal = append(out.MissingLocal, id)
		}
		out.Rows = append(out.Rows, row)
	}
	if len(used) != len(printed) {
		return out, fmt.Errorf("printed checks contain images absent from baseline")
	}
	for id := range locals {
		if !used[id] {
			out.ExtraLocal = append(out.ExtraLocal, id)
		}
	}
	for _, r := range after {
		if _, ok := baseline[r.ImageURL]; !ok {
			out.CurrentUnmatched = append(out.CurrentUnmatched, r)
		}
	}
	sort.Strings(out.MissingLocal)
	sort.Strings(out.ExtraLocal)
	return out, nil
}
