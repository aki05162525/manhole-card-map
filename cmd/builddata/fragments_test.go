package main

import (
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// No network or nationwide raw files: reviewed patches precede strict merge,
// then approved locations are added. Full card-source checks run during builddata.
func TestCheckedInRegionalFragments(t *testing.T) {
	root := filepath.Join("..", "..")
	cmd := exec.Command("python3", "-B", "tools/national/assemble.py")
	cmd.Dir = root
	raw, err := cmd.Output()
	if err != nil {
		if exit, ok := err.(*exec.ExitError); ok {
			t.Fatalf("national assembly: %v\n%s", err, exit.Stderr)
		}
		t.Fatal(err)
	}
	var ledger PlaceLedger
	if err := decodeLedger(raw, &ledger); err != nil {
		t.Fatal(err)
	}
	// Retain the production merger's schema and alias collision checks too.
	merged, err := mergeLedgers([]PlaceLedger{ledger})
	if err != nil {
		t.Fatal(err)
	}
	evs := []Evidence{}
	places := map[string]bool{}
	for _, p := range merged.Places {
		places[p.ID] = true
		evs = append(evs, p.Evidence)
	}
	for _, r := range merged.Relations {
		if r.Condition != nil {
			if err := validatePublicCondition(Relation{CardID: r.CardID, PlaceID: r.PlaceID, Condition: *r.Condition}); err != nil {
				t.Fatal(err)
			}
		}
		if !places[r.PlaceID] {
			t.Fatalf("unknown facility %s", r.PlaceID)
		}
		evs = append(evs, r.Evidence)
		if _, err := relationStatus(r, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)); err != nil {
			t.Fatal(err)
		}
	}
	for _, e := range evs {
		if !filepath.IsAbs(e.SnapshotPath) {
			e.SnapshotPath = filepath.Join(root, e.SnapshotPath)
		}
		if err := validateEvidence(e); err != nil {
			t.Fatal(err)
		}
	}
}

// ubuntu-latest supplies Python 3; assembly uses only its standard library.
// Do not skip these checks when the runtime is missing.
func TestNationalAssemblyFailureGuards(t *testing.T) {
	cmd := exec.Command("python3", "-B", "-m", "unittest", "discover", "-s", "tools/national", "-v")
	cmd.Dir = filepath.Join("..", "..")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("national assembly tests: %v\n%s", err, output)
	}
}

// The row files in data/db must reproduce the assembled ledger until stage C of Issue #237.
func TestLedgerDatabase(t *testing.T) {
	cmd := exec.Command("python3", "-B", "-m", "unittest", "discover", "-s", "tools/db", "-v")
	cmd.Dir = filepath.Join("..", "..")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("ledger database tests: %v\n%s", err, output)
	}
}
