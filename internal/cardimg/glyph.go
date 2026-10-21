package cardimg

import (
	"errors"
	"fmt"
	"image"
	"math"
	"sort"
	"strings"
)

// 座標の帯は、どのカードでも同じ書体と書式（DD°MM'SS.S"N と DDD°MM'SS.S"E）で印刷されている。
// そこで汎用の OCR ではなく、数字を1文字ずつ切り分け、正解ラベルから作った見本と形を比べて読む。

const (
	glyphW, glyphH = 10, 16
	latDigits      = 7 // DD MM SS S
	lngDigits      = 8 // DDD MM SS S
	coordScale     = 2
)

// Glyph は切り分けた1文字。
type Glyph struct {
	Rect image.Rectangle
	vec  []float64 // glyphW x glyphH に縮めた、各升目の黒の割合
}

// Templates は数字 0〜9 の見本。
type Templates [10][]float64

// CoordGlyphs は座標の帯から、緯度の数字7文字と経度の数字8文字を切り分ける。
// 数字の数が合わない場合（文字がつながった、途切れたなど）はエラーにし、人の確認に回す。
func CoordGlyphs(img image.Image) (lat, lng []Glyph, err error) {
	g := Crop(img, CoordRegion, coordScale)
	comps := components(g)

	// 帯の左端の縁など、2行にまたがる高さのものは文字ではない。
	H := g.Bounds().Dy()
	var cs []image.Rectangle
	for _, c := range comps {
		if c.Dy() < H*6/10 && c.Dx()*c.Dy() >= 6 {
			cs = append(cs, c)
		}
	}
	lines, err := splitLines(cs)
	if err != nil {
		return nil, nil, err
	}
	lat, err = tallGlyphs(g, lines[0], latDigits)
	if err != nil {
		return nil, nil, fmt.Errorf("緯度: %w", err)
	}
	lng, err = tallGlyphs(g, lines[1], lngDigits)
	if err != nil {
		return nil, nil, fmt.Errorf("経度: %w", err)
	}
	return lat, lng, nil
}

// splitLines は文字を2行に分ける。背の高い文字の縦の中心で、いちばん大きく離れたところを行の境目にする。
func splitLines(cs []image.Rectangle) ([2][]image.Rectangle, error) {
	var lines [2][]image.Rectangle
	maxH := 0
	for _, c := range cs {
		maxH = max(maxH, c.Dy())
	}
	var centers []int
	for _, c := range cs {
		if c.Dy() >= maxH/2 {
			centers = append(centers, (c.Min.Y+c.Max.Y)/2)
		}
	}
	if len(centers) < 2 {
		return lines, errors.New("文字が見つからない")
	}
	sort.Ints(centers)
	gap, border := 0, 0
	for i := 1; i < len(centers); i++ {
		if d := centers[i] - centers[i-1]; d > gap {
			gap, border = d, (centers[i]+centers[i-1])/2
		}
	}
	if gap < maxH/2 {
		return lines, errors.New("2行に分けられない")
	}
	for _, c := range cs {
		i := 0
		if (c.Min.Y+c.Max.Y)/2 > border {
			i = 1
		}
		lines[i] = append(lines[i], c)
	}
	return lines, nil
}

// tallGlyphs は1行の中から背の高い文字（数字と末尾の N または E）を左から並べ、数字だけを返す。
func tallGlyphs(g *image.Gray, line []image.Rectangle, digits int) ([]Glyph, error) {
	maxH := 0
	for _, c := range line {
		maxH = max(maxH, c.Dy())
	}
	var tall []image.Rectangle
	for _, c := range line {
		if c.Dy() >= maxH*7/10 {
			tall = append(tall, c)
		}
	}
	tall = splitJoined(g, tall)
	sort.Slice(tall, func(i, j int) bool { return tall[i].Min.X < tall[j].Min.X })
	if len(tall) != digits+1 {
		return nil, fmt.Errorf("背の高い文字が %d 個（数字 %d 個と方角 1 個を想定）", len(tall), digits)
	}
	glyphs := make([]Glyph, digits)
	for i, r := range tall[:digits] {
		glyphs[i] = Glyph{Rect: r, vec: shrink(g, r)}
	}
	return glyphs, nil
}

// splitJoined は、太字の数字どうしがくっついて1つになった塊（例: 「44」の横棒どうし）を分ける。
// 横幅が数字の幅の中央値の 1.6 倍を超える塊を、幅から推定した文字数に、黒の少ない列で切り分ける。
func splitJoined(g *image.Gray, rs []image.Rectangle) []image.Rectangle {
	if len(rs) == 0 {
		return rs
	}
	ws := make([]int, len(rs))
	for i, r := range rs {
		ws[i] = r.Dx()
	}
	sort.Ints(ws)
	med := ws[len(ws)/2]

	var out []image.Rectangle
	for _, r := range rs {
		if r.Dx()*10 <= med*16 {
			out = append(out, r)
			continue
		}
		n := int(math.Round(float64(r.Dx()) / float64(med)))
		x0 := r.Min.X
		for k := 1; k < n; k++ {
			// 等分した位置の前後で、黒画素がいちばん少ない列を切れ目にする。
			want := r.Min.X + k*r.Dx()/n
			cut, least := want, math.MaxInt
			for x := want - med/3; x <= want+med/3; x++ {
				black := 0
				for y := r.Min.Y; y < r.Max.Y; y++ {
					if g.Pix[y*g.Stride+x] == 0 {
						black++
					}
				}
				if black < least {
					cut, least = x, black
				}
			}
			out = append(out, image.Rect(x0, r.Min.Y, cut, r.Max.Y))
			x0 = cut
		}
		out = append(out, image.Rect(x0, r.Min.Y, r.Max.X, r.Max.Y))
	}
	return out
}

// components は黒画素の連結成分（8近傍）の外接矩形を返す。
func components(g *image.Gray) []image.Rectangle {
	b := g.Bounds()
	w, h := b.Dx(), b.Dy()
	seen := make([]bool, w*h)
	var out []image.Rectangle
	stack := make([]int, 0, 1024)
	for start := range seen {
		if seen[start] || g.Pix[start] != 0 {
			continue
		}
		// image.Rect は左上と右下を入れ替えて正規化するため、最小と最大を直接たどる。
		minX, minY, maxX, maxY := w, h, -1, -1
		stack = append(stack[:0], start)
		seen[start] = true
		for len(stack) > 0 {
			p := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			x, y := p%w, p/w
			minX, minY, maxX, maxY = min(minX, x), min(minY, y), max(maxX, x), max(maxY, y)
			for dy := -1; dy <= 1; dy++ {
				for dx := -1; dx <= 1; dx++ {
					nx, ny := x+dx, y+dy
					if nx < 0 || ny < 0 || nx >= w || ny >= h {
						continue
					}
					q := ny*w + nx
					if !seen[q] && g.Pix[q] == 0 {
						seen[q] = true
						stack = append(stack, q)
					}
				}
			}
		}
		out = append(out, image.Rect(minX, minY, maxX+1, maxY+1))
	}
	return out
}

// shrink は矩形の中身を glyphW x glyphH の升目に縮め、各升目の黒の割合を返す。
func shrink(g *image.Gray, r image.Rectangle) []float64 {
	v := make([]float64, glyphW*glyphH)
	for gy := 0; gy < glyphH; gy++ {
		y0 := r.Min.Y + gy*r.Dy()/glyphH
		y1 := max(r.Min.Y+(gy+1)*r.Dy()/glyphH, y0+1)
		for gx := 0; gx < glyphW; gx++ {
			x0 := r.Min.X + gx*r.Dx()/glyphW
			x1 := max(r.Min.X+(gx+1)*r.Dx()/glyphW, x0+1)
			black, n := 0, 0
			for y := y0; y < y1; y++ {
				for x := x0; x < x1; x++ {
					n++
					if g.Pix[y*g.Stride+x] == 0 {
						black++
					}
				}
			}
			v[gy*glyphW+gx] = float64(black) / float64(n)
		}
	}
	return v
}

// BuildTemplates は、正解の座標文字列が分かっている画像から数字の見本を作る。
// 同じ数字の見本が複数あれば平均する。
func BuildTemplates(samples map[image.Image]string) (Templates, error) {
	var sums [10][]float64
	var counts [10]int
	for img, text := range samples {
		lat, lng, err := CoordGlyphs(img)
		if err != nil {
			return Templates{}, fmt.Errorf("見本 %q: %w", text, err)
		}
		digits := onlyDigits(text)
		glyphs := append(lat, lng...)
		if len(digits) != len(glyphs) {
			return Templates{}, fmt.Errorf("見本 %q: 数字が %d 個（切り分けは %d 個）", text, len(digits), len(glyphs))
		}
		for i, d := range digits {
			if sums[d] == nil {
				sums[d] = make([]float64, glyphW*glyphH)
			}
			for k, x := range glyphs[i].vec {
				sums[d][k] += x
			}
			counts[d]++
		}
	}
	var t Templates
	for d := range t {
		if counts[d] == 0 {
			return Templates{}, fmt.Errorf("数字 %d の見本がない", d)
		}
		t[d] = make([]float64, len(sums[d]))
		for k, x := range sums[d] {
			t[d][k] = x / float64(counts[d])
		}
	}
	return t, nil
}

// Reading は座標の読み取り結果。
type Reading struct {
	Coord
	// Margin は、各数字で「いちばん近い見本」と「2番目に近い見本」の距離の差の最小値（0〜1）。
	// 小さいほど、どこかの数字が別の数字と紛らわしい。
	Margin float64
}

// ReadCoord は座標の帯を見本と照合して読む。
func (t Templates) ReadCoord(img image.Image) (Reading, error) {
	lat, lng, err := CoordGlyphs(img)
	if err != nil {
		return Reading{}, err
	}
	margin := 1.0
	read := func(gs []Glyph) string {
		var b strings.Builder
		for _, g := range gs {
			d, m := t.classify(g.vec)
			margin = math.Min(margin, m)
			b.WriteByte(byte('0' + d))
		}
		return b.String()
	}
	la, lo := read(lat), read(lng)
	text := fmt.Sprintf("%s°%s'%s.%s\"N\n%s°%s'%s.%s\"E", la[0:2], la[2:4], la[4:6], la[6:7], lo[0:3], lo[3:5], lo[5:7], lo[7:8])
	c, err := ParseCoord(text)
	if err != nil {
		return Reading{}, err
	}
	return Reading{Coord: c, Margin: margin}, nil
}

func (t Templates) classify(v []float64) (digit int, margin float64) {
	best, second := math.Inf(1), math.Inf(1)
	for d, tmpl := range t {
		dist := 0.0
		for k := range v {
			dist += math.Abs(v[k] - tmpl[k])
		}
		dist /= float64(len(v))
		switch {
		case dist < best:
			second, best, digit = best, dist, d
		case dist < second:
			second = dist
		}
	}
	return digit, second - best
}

func onlyDigits(s string) []int {
	var ds []int
	for _, r := range s {
		if r >= '0' && r <= '9' {
			ds = append(ds, int(r-'0'))
		}
	}
	return ds
}
