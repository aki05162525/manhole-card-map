package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// exportLedger writes the ledger that tools/build-real-data.py passes to builddata.
func exportLedger(t *testing.T, root, out string) []byte {
	t.Helper()
	cmd := exec.Command("python3", "-B", "tools/db/ledgerdb.py", "export-ledger", "--out", out)
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("export-ledger: %v\n%s", err, output)
	}
	raw, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// ledgerArgs passes the exported ledger with the review list and date of tools/build-real-data.py.
func ledgerArgs(t *testing.T, root string) []string {
	t.Helper()
	ledger := filepath.Join(t.TempDir(), "ledger.json")
	exportLedger(t, root, ledger)
	return []string{"-places", ledger, "-review-list", "data/raw/gkp-list-20261105.html", "-as-of", "2026-11-06"}
}

// ubuntu-latest supplies Python 3; the research tools use only its standard library
// unless a test skips for an optional package. Do not skip these checks when the runtime is missing.
func TestResearchTools(t *testing.T) {
	cmd := exec.Command("python3", "-B", "-m", "unittest", "discover", "-s", "tools/research", "-v")
	cmd.Dir = filepath.Join("..", "..")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("research tool tests: %v\n%s", err, output)
	}
}

// The row files in data/db are the ledger; these tests check their constraints.
func TestLedgerDatabase(t *testing.T) {
	cmd := exec.Command("python3", "-B", "-m", "unittest", "discover", "-s", "tools/db", "-v")
	cmd.Dir = filepath.Join("..", "..")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("ledger database tests: %v\n%s", err, output)
	}
}
