package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func generateManifest(t *testing.T, root, ledger string) []byte {
	t.Helper()
	out := filepath.Join(t.TempDir(), "public-data")
	internal := t.TempDir()
	cmd := exec.Command("go", "run", "./cmd/builddata", "-places", ledger, "-out", out, "-internal-out", internal,
		"-review-list", "data/raw/gkp-list-20261105.html", "-as-of", "2026-11-06")
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("builddata: %v\n%s", err, output)
	}
	manifest, err := os.ReadFile(filepath.Join(internal, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	return manifest
}

func TestManifestDoesNotDependOnLedgerLocation(t *testing.T) {
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	first := filepath.Join(t.TempDir(), "first.json")
	assemble := exec.Command("python3", "-B", "tools/national/assemble.py", "--out", first)
	assemble.Dir = root
	if output, err := assemble.CombinedOutput(); err != nil {
		t.Fatalf("assemble: %v\n%s", err, output)
	}
	ledger, err := os.ReadFile(first)
	if err != nil {
		t.Fatal(err)
	}
	second := filepath.Join(t.TempDir(), "elsewhere", "second.json")
	if err := os.MkdirAll(filepath.Dir(second), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(second, ledger, 0o644); err != nil {
		t.Fatal(err)
	}

	manifest := generateManifest(t, root, first)
	if !bytes.Equal(manifest, generateManifest(t, root, second)) {
		t.Fatal("manifest changed with the ledger location")
	}
	var report struct {
		Inputs map[string]string `json:"inputs"`
	}
	if err := json.Unmarshal(manifest, &report); err != nil {
		t.Fatal(err)
	}
	if report.Inputs[placesInputKey] == "" {
		t.Fatalf("ledger input missing: %v", report.Inputs)
	}
	for path := range report.Inputs {
		if filepath.IsAbs(path) || strings.Contains(path, "first.json") {
			t.Fatalf("local path stored in internal manifest: %s", path)
		}
	}
}
