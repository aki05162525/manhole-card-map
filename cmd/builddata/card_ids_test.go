package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestCardIDRegistry(t *testing.T) {
	for _, tt := range []struct {
		name     string
		registry CardIDRegistry
		current  []string
		want     string
	}{
		{"unchanged", CardIDRegistry{IDs: []string{"a"}}, []string{"a"}, ""},
		{"missing", CardIDRegistry{IDs: []string{"a"}}, nil, "disappeared"},
		{"new", CardIDRegistry{IDs: []string{"a"}}, []string{"a", "b"}, "-update-card-ids"},
		{"alias", CardIDRegistry{IDs: []string{"a", "b"}, Aliases: map[string]string{"a": "b"}}, []string{"b"}, ""},
		{"missing target", CardIDRegistry{IDs: []string{"a", "b"}, Aliases: map[string]string{"a": "b"}, Excluded: map[string]string{"b": "removed"}}, nil, "target"},
		{"chain", CardIDRegistry{IDs: []string{"a", "b", "c"}, Aliases: map[string]string{"a": "b", "b": "c"}}, []string{"c"}, "chain"},
		{"cycle", CardIDRegistry{IDs: []string{"a", "b"}, Aliases: map[string]string{"a": "b", "b": "a"}}, nil, "chain"},
		{"self", CardIDRegistry{IDs: []string{"a"}, Aliases: map[string]string{"a": "a"}}, []string{"a"}, "chain"},
		{"excluded", CardIDRegistry{IDs: []string{"a"}, Excluded: map[string]string{"a": "removed"}}, nil, ""},
		{"reused excluded", CardIDRegistry{IDs: []string{"a"}, Excluded: map[string]string{"a": "removed"}}, []string{"a"}, "reused"},
		{"reused alias", CardIDRegistry{IDs: []string{"a", "b"}, Aliases: map[string]string{"a": "b"}}, []string{"a", "b"}, "reused"},
		{"unknown alias", CardIDRegistry{IDs: []string{"b"}, Aliases: map[string]string{"a": "b"}}, []string{"b"}, "unregistered"},
		{"unknown exclusion", CardIDRegistry{Excluded: map[string]string{"a": "removed"}}, nil, "unregistered"},
		{"empty reason", CardIDRegistry{IDs: []string{"a"}, Excluded: map[string]string{"a": " "}}, nil, "reason"},
		{"overlap", CardIDRegistry{IDs: []string{"a", "b"}, Aliases: map[string]string{"a": "b"}, Excluded: map[string]string{"a": "removed"}}, []string{"b"}, "both"},
		{"duplicate", CardIDRegistry{IDs: []string{"a", "a"}}, []string{"a"}, "duplicate"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.registry.validate(tt.current)
			if tt.want == "" {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("want %q, got %v", tt.want, err)
			}
		})
	}
}

func TestCardIDRegistryUpdatePreservesHistory(t *testing.T) {
	r := CardIDRegistry{IDs: []string{"old", "current"}, Aliases: map[string]string{"old": "current"}, Excluded: map[string]string{}}
	r.add([]string{"new", "current"})
	r.add([]string{"new"})
	if err := r.validate([]string{"new", "current"}); err != nil {
		t.Fatal(err)
	}
	if len(r.IDs) != 3 || r.Aliases["old"] != "current" {
		t.Fatalf("lost history: %+v", r)
	}
	r.Excluded["new"] = "removed"
	r.add([]string{"new", "current"})
	if err := r.validate([]string{"new", "current"}); err == nil {
		t.Fatal("update allowed reuse")
	}
}

func TestPublicCardAliases(t *testing.T) {
	p, err := publicData(Data{CardAliases: map[string]string{"old": "current"}})
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), `"cardAliases":{"old":"current"}`) {
		t.Fatalf("lost aliases: %s", b)
	}
}

// Exercise the build entry point as CI does, so registry validation cannot be
// accidentally detached from generation while the pure unit tests still pass.
func TestBuildRejectsUnregisteredCardID(t *testing.T) {
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(root, "data/card-ids.json"))
	if err != nil {
		t.Fatal(err)
	}
	var registry CardIDRegistry
	if err := json.Unmarshal(raw, &registry); err != nil {
		t.Fatal(err)
	}
	// ids is append-only history, so drop a currently generated ID rather than
	// a retired one that aliases or exclusions still reference.
	removed := -1
	for i, id := range registry.IDs {
		_, alias := registry.Aliases[id]
		_, excluded := registry.Excluded[id]
		if !alias && !excluded {
			removed = i
			break
		}
	}
	if removed < 0 {
		t.Fatal("registry has no current card ID")
	}
	registry.IDs = append(registry.IDs[:removed:removed], registry.IDs[removed+1:]...)
	raw, err = json.Marshal(registry)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "card-ids.json")
	if err := os.WriteFile(path, raw, 0644); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("go", "run", "./cmd/builddata", "-card-ids", path, "-out", filepath.Join(dir, "public"), "-internal-out", filepath.Join(dir, "internal"))
	cmd.Dir = root
	output, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(output), "-update-card-ids") {
		t.Fatalf("expected unregistered ID failure, got %v: %s", err, output)
	}
	if _, err := os.Stat(filepath.Join(dir, "public")); !os.IsNotExist(err) {
		t.Fatalf("failed build wrote public output: %v", err)
	}
	cmd = exec.Command("go", "run", "./cmd/builddata", "-card-ids", path, "-update-card-ids", "-out", filepath.Join(dir, "public"), "-internal-out", filepath.Join(dir, "internal"))
	cmd.Dir = root
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("update failed: %v: %s", err, output)
	}
	updated, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var got CardIDRegistry
	if err := json.Unmarshal(updated, &got); err != nil {
		t.Fatal(err)
	}
	var original CardIDRegistry
	if err := json.Unmarshal(mustReadRegistry(t, filepath.Join(root, "data/card-ids.json")), &original); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, original) {
		t.Fatal("update did not restore exactly the missing ID")
	}
}

func mustReadRegistry(t *testing.T, path string) []byte {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return b
}
