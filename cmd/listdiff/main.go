// listdiff compares saved official lists without fetching or publishing them.
package main

import (
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"reflect"
	"sort"
	"strings"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

type change struct {
	ImageURL string   `json:"imageUrl"`
	Fields   []string `json:"fields"`
	Before   gkp.Row  `json:"before"`
	After    gkp.Row  `json:"after"`
}
type report struct {
	Identity    string            `json:"identity"`
	BeforeCount int               `json:"beforeCount"`
	AfterCount  int               `json:"afterCount"`
	Added       []gkp.Row         `json:"added"`
	Removed     []gkp.Row         `json:"removed"`
	Changed     []change          `json:"changed"`
	Inputs      map[string]string `json:"inputSHA256,omitempty"`
}

func index(rows []gkp.Row) (map[string]gkp.Row, error) {
	result := map[string]gkp.Row{}
	for _, r := range rows {
		if strings.TrimSpace(r.ImageURL) == "" {
			return nil, fmt.Errorf("row %d: missing image URL; manual identity review required", r.Index)
		}
		if _, ok := result[r.ImageURL]; ok {
			return nil, fmt.Errorf("duplicate image URL: %s", r.ImageURL)
		}
		result[r.ImageURL] = r
	}
	return result, nil
}

func compare(before, after []gkp.Row) (report, error) {
	r := report{Identity: "Exact image URL only; additions/removals require printed card ID reconciliation before adoption", BeforeCount: len(before), AfterCount: len(after), Added: []gkp.Row{}, Removed: []gkp.Row{}, Changed: []change{}}
	a, err := index(before)
	if err != nil {
		return r, err
	}
	b, err := index(after)
	if err != nil {
		return r, err
	}
	for key, old := range a {
		current, ok := b[key]
		if !ok {
			r.Removed = append(r.Removed, old)
			continue
		}
		fields := []string{}
		ov, nv := reflect.ValueOf(old), reflect.ValueOf(current)
		for i := 0; i < ov.NumField(); i++ {
			name := ov.Type().Field(i).Name
			if name != "Index" && !reflect.DeepEqual(ov.Field(i).Interface(), nv.Field(i).Interface()) {
				fields = append(fields, name)
			}
		}
		if len(fields) > 0 {
			r.Changed = append(r.Changed, change{key, fields, old, current})
		}
	}
	for key, current := range b {
		if _, ok := a[key]; !ok {
			r.Added = append(r.Added, current)
		}
	}
	sort.Slice(r.Added, func(i, j int) bool { return r.Added[i].ImageURL < r.Added[j].ImageURL })
	sort.Slice(r.Removed, func(i, j int) bool { return r.Removed[i].ImageURL < r.Removed[j].ImageURL })
	sort.Slice(r.Changed, func(i, j int) bool { return r.Changed[i].ImageURL < r.Changed[j].ImageURL })
	return r, nil
}

func main() {
	before := flag.String("before", "", "previous saved official HTML")
	after := flag.String("after", "", "new saved official HTML")
	out := flag.String("out", "", "JSON output (default stdout)")
	flag.Parse()
	if *before == "" || *after == "" {
		log.Fatal("-before and -after are required")
	}
	inputs := map[string]string{}
	read := func(path string) []gkp.Row {
		b, err := os.ReadFile(path)
		if err != nil {
			log.Fatal(err)
		}
		inputs[path] = fmt.Sprintf("%x", sha256.Sum256(b))
		rows, err := gkp.ParseList(strings.NewReader(string(b)))
		if err != nil {
			log.Fatal(err)
		}
		return rows
	}
	r, err := compare(read(*before), read(*after))
	if err != nil {
		log.Fatal(err)
	}
	r.Inputs = inputs
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		log.Fatal(err)
	}
	b = append(b, '\n')
	if *out == "" {
		_, err = os.Stdout.Write(b)
	} else {
		err = os.WriteFile(*out, b, 0644)
	}
	if err != nil {
		log.Fatal(err)
	}
}
