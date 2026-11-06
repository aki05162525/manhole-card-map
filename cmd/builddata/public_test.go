package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
)

func TestPublicOutputIsSeparated(t *testing.T) {
	root, _ := filepath.Abs("../..")
	out := t.TempDir()
	internal := t.TempDir()
	for _, suffix := range []string{"", ".gz", ".br"} {
		if err := os.WriteFile(filepath.Join(out, "quality.json"+suffix), []byte("legacy"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	cmd := exec.Command("go", "run", "./cmd/builddata", "-out", out, "-internal-out", internal)
	cmd.Dir = root
	if b, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, b)
	}
	read := func(dir, name string) map[string]any {
		b, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatal(err)
		}
		var v map[string]any
		if err := json.Unmarshal(b, &v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	pub, private := read(out, "full.json"), read(internal, "full.json")
	if _, err := os.Stat(filepath.Join(out, "quality.json")); !os.IsNotExist(err) {
		t.Fatal("public quality report")
	}
	read(internal, "quality.json")
	if _, ok := read(out, "manifest.json")["inputs"]; ok {
		t.Fatal("public inputs")
	}
	if read(internal, "manifest.json")["inputs"] == nil {
		t.Fatal("missing internal inputs")
	}
	for _, name := range []string{"cards", "places", "relations", "pins"} {
		if len(pub[name].([]any)) != len(private[name].([]any)) {
			t.Fatalf("changed %s count", name)
		}
	}
	for _, item := range pub["places"].([]any) {
		p := item.(map[string]any)
		if _, ok := p["evidence"]; ok {
			t.Fatal("public place evidence")
		}
		for k := range p["coordinate"].(map[string]any) {
			if k != "lat" && k != "lng" && k != "status" {
				t.Fatalf("public coordinate %s", k)
			}
		}
	}
	if private["cards"].([]any)[0].(map[string]any)["lid"].(map[string]any)["source"] == nil {
		t.Fatal("lost internal source")
	}
}

func TestPublicAllowlistPreservesDisplayFields(t *testing.T) {
	lat, lng := 35.0, 139.0
	coordinate := Coordinate{Status: "confirmed", Lat: &lat, Lng: &lng, Source: "data/work/private", Review: "private", Level: "private", Reason: "表示する蓋の説明"}
	evidence := &Evidence{SourceURL: "https://example.jp", CheckedAt: "2026-11-06", SnapshotPath: "data/evidence/private", SnapshotSHA256: "private", SourceLocator: "private", ActorType: "private", VerificationMethod: "private"}
	d := Data{Schema: 1, Updated: "2026-11-06", ReviewSource: "data/raw/private", EvaluatedAt: "2026-11-06",
		Cards:     []Card{{ID: "card", Lid: coordinate, Override: json.RawMessage(`{"checkedAt":"today","evidence":"画面の説明","reviewer":"human","futurePrivateField":"secret","note":"private"}`), Municipality: json.RawMessage(`{"private":true}`), ReviewSourceHash: "private"}},
		Places:    []Place{{ID: "place", Coordinate: coordinate, Evidence: evidence, LocationReview: &LocationReview{Status: "needs-review", AddressStatus: "valid", Reason: "表示する注意", DecisionID: "private", SourceVersion: "private"}}},
		Relations: []Relation{{CardID: "card", PlaceID: "place", Evidence: evidence, ReviewUntil: "private", Raw: []string{"private"}, Interpretation: "private", Change: &RelationChange{Reason: "private"}}}}
	got, err := publicData(d)
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if err := json.Unmarshal(b, &value); err != nil {
		t.Fatal(err)
	}
	expected := `{"schema":1,"updated":"2026-11-06","evaluatedAt":"2026-11-06","cards":[{"id":"card","city":"","pref":"","series":"","issued":"","status":"","lid":{"status":"confirmed","lat":35,"lng":139,"reason":"表示する蓋の説明"},"placeText":null,"hours":null,"links":null,"acquired":""}],"places":[{"id":"place","name":"","address":"","phone":"","coordinate":{"status":"confirmed","lat":35,"lng":139},"locationReview":{"status":"needs-review","addressStatus":"valid","reason":"表示する注意"}}],"relations":[{"cardId":"card","placeId":"place","condition":"","periodRaw":"","alternativeRaw":"","evidence":{"sourceUrl":"https://example.jp","checkedAt":"2026-11-06"}}],"pins":[]}`
	var want any
	if err := json.Unmarshal([]byte(expected), &want); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(value, want) {
		t.Fatalf("public contract differs: %s", b)
	}
	if d.Places[0].Evidence.SnapshotPath != "data/evidence/private" {
		t.Fatal("internal data mutated")
	}
}

func TestInternalOutputCannotEnterWeb(t *testing.T) {
	root, _ := filepath.Abs("../..")
	old, _ := os.Getwd()
	if err := os.Chdir(root); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(old)
	for _, path := range []string{"web/public/internal", "web/dist/internal", "web/dist-fixture/internal", "web/public/data", "web"} {
		if validateOutputDirectories("web/public/data", path) == nil {
			t.Fatalf("accepted internal path %s", path)
		}
	}
	dir := t.TempDir()
	if err := os.Symlink(filepath.Join(root, "web"), filepath.Join(dir, "alias")); err != nil {
		t.Fatal(err)
	}
	if validateOutputDirectories("web/public/data", filepath.Join(dir, "alias", "new")) == nil {
		t.Fatal("accepted symlink into web")
	}
	if validateOutputDirectories(dir, filepath.Join(dir, "internal")) == nil {
		t.Fatal("overlapping outputs")
	}
	if err := validateOutputDirectories("web/public/data", "data/work/internal-data"); err != nil {
		t.Fatal(err)
	}
}
