package municipality

import (
	"math"
	"os"
	"strings"
	"testing"
)

func TestPolygons(t *testing.T) {
	d, err := Load(strings.NewReader(`{"type":"FeatureCollection","features":[
{"properties":{"N03_007":"13104","N03_001":"東京都","N03_004":"新宿区"},"geometry":{"type":"Polygon","coordinates":[[[139,35],[140,35],[140,36],[139,36],[139,35]],[[139.4,35.4],[139.6,35.4],[139.6,35.6],[139.4,35.6],[139.4,35.4]]]}},
{"properties":{"N03_007":"13105","N03_001":"東京都","N03_004":"文京区"},"geometry":{"type":"MultiPolygon","coordinates":[[[[140,35],[141,35],[141,36],[140,36],[140,35]]],[[[142,35],[143,35],[143,36],[142,36],[142,35]]]]}}
]}`))
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name string
		p    Point
		want int
	}{
		{"内側", Point{139.2, 35.2}, 1}, {"外側", Point{138, 35.5}, 0},
		{"穴", Point{139.5, 35.5}, 0}, {"穴の縁", Point{139.4, 35.5}, 1},
		{"共有境界", Point{140, 35.5}, 2}, {"頂点", Point{140, 35}, 2},
		{"離島", Point{142.5, 35.5}, 1}, {"微小に外側", Point{138.99999, 35.5}, 0},
		{"不正", Point{math.NaN(), 35}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := len(d.Locate(tc.p)); got != tc.want {
				t.Fatalf("got %d want %d", got, tc.want)
			}
		})
	}
	v, _ := d.Distance(Point{138.99999, 35.5}, map[string]bool{"13104": true})
	if v < 0.8 || v > 1.0 {
		t.Fatalf("境界の約0.9m外: %f", v)
	}
	v, _ = d.Distance(Point{139.5, 35.5}, map[string]bool{"13104": true})
	if v < 9000 || v > 9100 {
		t.Fatalf("穴の縁まで約9km: %f", v)
	}
	v, _ = d.Distance(Point{140, 35.5}, nil)
	if v != 0 {
		t.Fatal(v)
	}
	v, _ = d.Distance(Point{140, 35.5}, map[string]bool{})
	if !math.IsInf(v, 1) {
		t.Fatal(v)
	}
}

func TestInvalidGeometry(t *testing.T) {
	for _, s := range []string{`{}`, `{"type":"FeatureCollection","features":[]}`, `{"type":"FeatureCollection","features":[{"properties":{"N03_007":"13104","N03_001":"東京都","N03_004":"新宿区"},"geometry":{"type":"Point","coordinates":[139,35]}}]}`} {
		if _, err := Load(strings.NewReader(s)); err == nil {
			t.Fatalf("不正な入力を受理: %s", s)
		}
	}
}

// 実データはコミットしない。N03_ZIP を指定したときだけ全国版を読む。
func TestN03(t *testing.T) {
	filename := os.Getenv("N03_ZIP")
	if filename == "" {
		t.Skip("実データの検査には N03_ZIP を指定する")
	}
	d, err := LoadZIP(filename, "N03-20260101.geojson")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		p    Point
		code string
	}{
		{Point{139.691778, 35.689627}, "13104"},
		{Point{135.495965, 34.702714}, "27127"},
	} {
		got := d.Locate(tc.p)
		if len(got) != 1 || got[0].Code != tc.code {
			t.Fatalf("%v: %+v", tc.p, got)
		}
	}
	t.Logf("%d 自治体、%d 多角形", len(d.Areas()), d.PolygonCount())
}
