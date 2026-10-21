// Package municipality は N03 の多角形と座標を照合する。座標や自治体コードは補正しない。
package municipality

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"sort"
	"strings"
)

// Point は経度、緯度の順に保持する。GeoJSON と同じ順序である。
type Point [2]float64

type Area struct {
	Code   string `json:"code"`
	Pref   string `json:"pref"`
	County string `json:"county,omitempty"`
	City   string `json:"city"`
	Ward   string `json:"ward,omitempty"`
}

type polygon struct {
	area     Area
	rings    [][]Point
	min, max Point
}

type Dataset struct {
	polygons []polygon
	areas    map[string]Area
}

// LoadZIP は全国版 ZIP 中の指定した GeoJSON だけを読み、ファイルへ展開しない。
func LoadZIP(filename, member string) (*Dataset, error) {
	z, err := zip.OpenReader(filename)
	if err != nil {
		return nil, err
	}
	defer z.Close()
	for _, f := range z.File {
		if f.Name != member {
			continue
		}
		r, err := f.Open()
		if err != nil {
			return nil, err
		}
		defer r.Close()
		return Load(r)
	}
	return nil, fmt.Errorf("ZIP に %s がない", member)
}

// Load は FeatureCollection を1地物ずつ読む。穴は外周の向きに依存せず扱う。
func Load(r io.Reader) (*Dataset, error) {
	d := &Dataset{areas: map[string]Area{}}
	dec := json.NewDecoder(r)
	if t, err := dec.Token(); err != nil || t != json.Delim('{') {
		return nil, fmt.Errorf("GeoJSON の先頭がオブジェクトではない: %v", err)
	}
	typeName, found := "", false
	for dec.More() {
		t, err := dec.Token()
		if err != nil {
			return nil, err
		}
		switch t {
		case "type":
			if err := dec.Decode(&typeName); err != nil {
				return nil, err
			}
		case "features":
			found = true
			if t, err := dec.Token(); err != nil || t != json.Delim('[') {
				return nil, fmt.Errorf("features が配列ではない")
			}
			for dec.More() {
				var f struct {
					Properties map[string]string `json:"properties"`
					Geometry   struct {
						Type        string
						Coordinates json.RawMessage
					} `json:"geometry"`
				}
				if err := dec.Decode(&f); err != nil {
					return nil, err
				}
				a := Area{Code: f.Properties["N03_007"], Pref: f.Properties["N03_001"], County: f.Properties["N03_003"], City: f.Properties["N03_004"], Ward: f.Properties["N03_005"]}
				if len(a.Code) != 5 || a.Pref == "" || a.City == "" {
					return nil, fmt.Errorf("N03 属性が不完全: %+v", a)
				}
				var polygons [][][]Point
				switch f.Geometry.Type {
				case "Polygon":
					var rings [][]Point
					if err := json.Unmarshal(f.Geometry.Coordinates, &rings); err != nil {
						return nil, err
					}
					polygons = [][][]Point{rings}
				case "MultiPolygon":
					if err := json.Unmarshal(f.Geometry.Coordinates, &polygons); err != nil {
						return nil, err
					}
				default:
					return nil, fmt.Errorf("未対応の形状: %s", f.Geometry.Type)
				}
				for _, rings := range polygons {
					p := polygon{area: a, rings: rings, min: Point{180, 90}, max: Point{-180, -90}}
					if len(rings) == 0 {
						return nil, fmt.Errorf("空の多角形: %s", a.Code)
					}
					for _, ring := range rings {
						if len(ring) < 4 || ring[0] != ring[len(ring)-1] {
							return nil, fmt.Errorf("閉じていない外周または穴: %s", a.Code)
						}
						for _, pt := range ring {
							if !pt.Valid() {
								return nil, fmt.Errorf("不正な座標: %v", pt)
							}
							for k := range 2 {
								p.min[k] = math.Min(p.min[k], pt[k])
								p.max[k] = math.Max(p.max[k], pt[k])
							}
						}
					}
					d.polygons = append(d.polygons, p)
				}
				d.areas[a.Code] = a
			}
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
		default:
			var unused json.RawMessage
			if err := dec.Decode(&unused); err != nil {
				return nil, err
			}
		}
	}
	if _, err := dec.Token(); err != nil {
		return nil, err
	}
	if typeName != "FeatureCollection" || !found || len(d.polygons) == 0 {
		return nil, fmt.Errorf("空または未対応の GeoJSON")
	}
	return d, nil
}

func (p Point) Valid() bool {
	return !math.IsNaN(p[0]) && !math.IsNaN(p[1]) && !math.IsInf(p[0], 0) && !math.IsInf(p[1], 0) && math.Abs(p[0]) <= 180 && math.Abs(p[1]) <= 90
}

func (d *Dataset) Areas() []Area {
	a := make([]Area, 0, len(d.areas))
	for _, v := range d.areas {
		a = append(a, v)
	}
	sort.Slice(a, func(i, j int) bool { return a[i].Code < a[j].Code })
	return a
}

func (d *Dataset) PolygonCount() int { return len(d.polygons) }

// Locate は境界上を含むすべての自治体を返す。共有境界で1自治体へ決め打ちしない。
func (d *Dataset) Locate(pt Point) []Area {
	var result []Area
	seen := map[string]bool{}
	if !pt.Valid() {
		return result
	}
	for _, p := range d.polygons {
		if pt[0] < p.min[0] || pt[0] > p.max[0] || pt[1] < p.min[1] || pt[1] > p.max[1] || seen[p.area.Code] {
			continue
		}
		inside, boundary := inRing(pt, p.rings[0])
		if !inside && !boundary {
			continue
		}
		if !boundary {
			for _, hole := range p.rings[1:] {
				in, on := inRing(pt, hole)
				if on {
					boundary = true
					break
				}
				if in {
					inside = false
					break
				}
			}
		}
		if inside || boundary {
			result = append(result, p.area)
			seen[p.area.Code] = true
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Code < result[j].Code })
	return result
}

func inRing(p Point, ring []Point) (inside, boundary bool) {
	for i := 1; i < len(ring); i++ {
		a, b := ring[i-1], ring[i]
		if segmentDistance(p, a, b, 1, 1) <= 1e-10 {
			return true, true
		}
		if (a[1] > p[1]) != (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0] {
			inside = !inside
		}
	}
	return inside, false
}

// Distance は選んだ自治体の外周または穴の縁までの最短距離（m）を返す。
// 指定が nil なら全国を探す。市や県をまとめても内部の区界は取り除かない。
// 点の緯度で正距円筒近似するため、遠距離の値は概算として扱う。
func (d *Dataset) Distance(pt Point, codes map[string]bool) (float64, Area) {
	best := math.Inf(1)
	var nearest Area
	if !pt.Valid() {
		return best, nearest
	}
	sy := 6371008.8 * math.Pi / 180
	sx := sy * math.Cos(pt[1]*math.Pi/180)
	for _, p := range d.polygons {
		if codes != nil && !codes[p.area.Code] {
			continue
		}
		dx := math.Max(0, math.Max(p.min[0]-pt[0], pt[0]-p.max[0])) * sx
		dy := math.Max(0, math.Max(p.min[1]-pt[1], pt[1]-p.max[1])) * sy
		if math.Hypot(dx, dy) > best {
			continue
		}
		for _, ring := range p.rings {
			for i := 1; i < len(ring); i++ {
				v := segmentDistance(pt, ring[i-1], ring[i], sx, sy)
				if v < best {
					best = v
					nearest = p.area
				}
			}
		}
	}
	return best, nearest
}

func segmentDistance(p, a, b Point, sx, sy float64) float64 {
	ax, ay := (a[0]-p[0])*sx, (a[1]-p[1])*sy
	dx, dy := (b[0]-a[0])*sx, (b[1]-a[1])*sy
	t := 0.0
	if n := dx*dx + dy*dy; n > 0 {
		t = math.Max(0, math.Min(1, -(ax*dx+ay*dy)/n))
	}
	return math.Hypot(ax+t*dx, ay+t*dy)
}

// Codes は県、市、区の比較範囲を N03 の属性から作る。
func (d *Dataset) Codes(pref, city, ward string) map[string]bool {
	c := map[string]bool{}
	for code, a := range d.areas {
		if (pref == "" || a.Pref == pref) && (city == "" || a.City == city) && (ward == "" || a.Ward == ward) {
			c[code] = true
		}
	}
	return c
}

func (d *Dataset) PrefCodes(prefix string) map[string]bool {
	c := map[string]bool{}
	for code := range d.areas {
		if strings.HasPrefix(code, prefix) {
			c[code] = true
		}
	}
	return c
}
