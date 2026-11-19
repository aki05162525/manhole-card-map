package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestJSONFileErrors(t *testing.T) {
	p := filepath.Join(t.TempDir(), "broken.json")
	if err := os.WriteFile(p, []byte("{"), 0600); err != nil {
		t.Fatal(err)
	}
	var v any
	if err := read(p, &v); err == nil || !strings.Contains(err.Error(), p) {
		t.Fatalf("read: %v", err)
	}
	var batch outputBatch
	defer batch.cleanup()
	if _, err := batch.write(filepath.Join(p, "output"), v); err == nil {
		t.Fatal("write under a regular file succeeded")
	}
}

func TestBuildFailures(t *testing.T) {
	t.Chdir("../..")
	dir := t.TempDir()
	ledger := filepath.Join(dir, "ledger.json")
	exportLedger(t, ".", ledger)
	base := buildOptions{list: "data/raw/gkp-list-20261021.html", checks: "data/work/municheck.json", date: "2026-10-21", evaluationDate: "2026-11-17", reviewList: "data/raw/gkp-list-20261105.html", ledgerPath: ledger, cardIDsPath: "data/card-ids.json", cardImagesPath: "data/card-images.json", out: filepath.Join(dir, "public"), internalOut: filepath.Join(dir, "audit")}
	put := func(p, s string) {
		t.Helper()
		if err := os.WriteFile(p, []byte(s), 0644); err != nil {
			t.Fatal(err)
		}
	}
	t.Run("images", func(t *testing.T) {
		o := base
		o.cardImagesPath = filepath.Join(dir, "broken.json")
		put(o.cardImagesPath, "{")
		if err := build(o); err == nil || !strings.Contains(err.Error(), o.cardImagesPath) {
			t.Fatalf("error = %v", err)
		}
	})
	t.Run("outputs", func(t *testing.T) {
		o := base
		for _, d := range []string{o.out, o.internalOut} {
			if err := os.Mkdir(d, 0755); err != nil {
				t.Fatal(err)
			}
			names := []string{"full.json", "details.json", "pins.json", "manifest.json"}
			if d == o.internalOut {
				names = append(names, "quality.json")
			}
			for _, n := range names {
				p := filepath.Join(d, n)
				if d == o.out && n == "details.json" {
					if err := os.Mkdir(p, 0755); err != nil {
						t.Fatal(err)
					}
				} else {
					put(p, "previous")
				}
			}
		}
		if err := build(o); err == nil {
			t.Fatal("expected output failure")
		}
		for _, d := range []string{o.out, o.internalOut} {
			entries, err := os.ReadDir(d)
			if err != nil {
				t.Fatal(err)
			}
			want := 4
			if d == o.internalOut {
				want = 5
			}
			if len(entries) != want {
				t.Errorf("unexpected entries: %v", entries)
			}
			for _, e := range entries {
				if d == o.out && e.Name() == "details.json" && e.IsDir() {
					continue
				}
				b, err := os.ReadFile(filepath.Join(d, e.Name()))
				if err != nil || string(b) != "previous" {
					t.Errorf("changed %s/%s", d, e.Name())
				}
			}
		}
	})
	t.Run("registry", func(t *testing.T) {
		o := base
		o.internalOut = o.out
		o.updateCardIDs = true
		o.cardIDsPath = filepath.Join(dir, "ids.json")
		raw, err := os.ReadFile(base.cardIDsPath)
		if err != nil {
			t.Fatal(err)
		}
		original := string(raw) + "\n"
		put(o.cardIDsPath, original)
		if err := build(o); err == nil {
			t.Fatal("expected validation failure")
		}
		b, err := os.ReadFile(o.cardIDsPath)
		if err != nil || string(b) != original {
			t.Fatal("registry changed")
		}
	})
}
