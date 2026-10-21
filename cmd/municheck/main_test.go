package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aki05162525/manhole-card-map/internal/municipality"
)

func TestReview(t *testing.T) {
	path := filepath.Join(t.TempDir(), "review.html")
	r := result{Kind: "lid", Index: 1, City: "<確認>", Image: "test.jpg", Review: true, Level: "city"}
	if err := writeReview(path, report{ThresholdM: 50, Results: []result{r}}); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), "&lt;確認&gt;") || !strings.Contains(string(b), "city") {
		t.Fatal("確認ページの値が出力されない")
	}
}

func fixture(t *testing.T) *municipality.Dataset {
	t.Helper()
	d, e := municipality.Load(strings.NewReader(`{"type":"FeatureCollection","features":[
{"properties":{"N03_007":"27127","N03_001":"大阪府","N03_004":"大阪市","N03_005":"北区"},"geometry":{"type":"Polygon","coordinates":[[[135,34],[136,34],[136,35],[135,35],[135,34]]]}},
{"properties":{"N03_007":"27102","N03_001":"大阪府","N03_004":"大阪市","N03_005":"都島区"},"geometry":{"type":"Polygon","coordinates":[[[136,34],[137,34],[137,35],[136,35],[136,34]]]}},
{"properties":{"N03_007":"27201","N03_001":"大阪府","N03_004":"岸和田市"},"geometry":{"type":"Polygon","coordinates":[[[134,34],[135,34],[135,35],[134,35],[134,34]]]}},
{"properties":{"N03_007":"13104","N03_001":"東京都","N03_004":"新宿区"},"geometry":{"type":"Polygon","coordinates":[[[139,35],[140,35],[140,36],[139,36],[139,35]]]}}
]}`))
	if e != nil {
		t.Fatal(e)
	}
	return d
}

func TestTargets(t *testing.T) {
	d := fixture(t)
	for _, tc := range []struct {
		code, scope string
		n           int
	}{
		{"27-100-A001", "city", 2}, {"27-000-A001", "prefecture", 3}, {"13-100-A001", "tokyo23", 1},
		{"27-201-A001", "municipality", 1}, {"00-101-A001", "national", 0}, {"27-999-A001", "unresolved", 0}, {"bad", "unresolved", 0},
	} {
		r := codeTarget(d, tc.code)
		if r.Scope != tc.scope || len(r.Codes) != tc.n {
			t.Errorf("%s: %+v", tc.code, r)
		}
	}
	for _, name := range []string{"大阪市 (D001)", "大阪府 大阪市 （D001）"} {
		if r := nameTarget(d, "大阪府", name, "27-100-D001"); len(r.Codes) != 2 {
			t.Error(r)
		}
	}
	if r := nameTarget(d, "東京都", "東京都 新宿区 (O001)", "13-100-O001"); len(r.Codes) != 1 || r.Codes[0] != "13104" {
		t.Error(r)
	}
	if r := nameTarget(d, "大阪府", "未知市", "27-999-A001"); len(r.Codes) != 0 {
		t.Error(r)
	}
	if r := nameTarget(d, "大阪府", "大阪市 (B001) 管理組合", "27-100-B001"); len(r.Codes) != 2 {
		t.Error(r)
	}
	if r := nameTarget(d, "東京都", "東京都都市づくり公社", "13-010-A001"); r.Scope != "prefecture" {
		t.Error(r)
	}
}

func TestClassification(t *testing.T) {
	d := fixture(t)
	target := codeTarget(d, "27-100-A001")
	for _, tc := range []struct {
		p    municipality.Point
		want string
	}{
		{municipality.Point{135.5, 34.5}, "一致"},
		{municipality.Point{134.9999, 34.5}, "境界付近"},
		{municipality.Point{134.5, 34.5}, "不一致"},
		{municipality.Point{135.5, 35.00001}, "判定不能"},
	} {
		r := classify(d, tc.p, d.Locate(tc.p), target, 50)
		if r.Status != tc.want {
			t.Errorf("%v: %+v", tc.p, r)
		}
	}
	lat, lng := 34.5, 135.5
	r := result{Lat: &lat, Lng: &lng, Code: "27-100-A001"}
	evaluate(d, &r, 50, "上書き記録で未確定")
	if r.ByCode.Status != "対象外" {
		t.Fatal(r)
	}
	r = result{Lat: &lat, Lng: &lng, Code: "00-101-A001"}
	evaluate(d, &r, 50, "")
	if r.ByName.Status != "対象外" {
		t.Fatal(r)
	}
}
