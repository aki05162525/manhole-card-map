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
	if _, err := write(filepath.Join(p, "output"), v); err == nil {
		t.Fatal("write under a regular file succeeded")
	}
}
