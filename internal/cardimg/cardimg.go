// Package cardimg は、カード画像からカード番号と蓋の座標を読み取る。
// 読み取りには Tesseract（tesseract コマンド）を使う。
package cardimg

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/image/draw"
)

// Region はカード画像の中の領域を、幅と高さに対する比率で表す。
// 画像の大きさは 513〜518 x 720〜722 で揺れるため、画素ではなく比率で指定する。
type Region struct{ X0, Y0, X1, Y1 float64 }

var (
	// CodeRegion は右上の枠に印刷されたカード番号（例: 13-100-A001）。
	CodeRegion = Region{0.72, 0.025, 0.975, 0.09}
	// CoordRegion は左下の帯に2行で印刷された蓋の座標。
	CoordRegion = Region{0.03, 0.835, 0.60, 0.955}
)

// Crop は領域を切り出し、拡大して白地に黒字の2値画像にする。
// カードの色によって、番号や座標は暗い地に白字のことも、明るい地に暗い字のこともある。
func Crop(img image.Image, r Region, scale int) *image.Gray {
	b := img.Bounds()
	rect := image.Rect(
		b.Min.X+int(r.X0*float64(b.Dx())), b.Min.Y+int(r.Y0*float64(b.Dy())),
		b.Min.X+int(r.X1*float64(b.Dx())), b.Min.Y+int(r.Y1*float64(b.Dy())),
	)
	gray := image.NewGray(image.Rect(0, 0, rect.Dx()*scale, rect.Dy()*scale))
	draw.CatmullRom.Scale(gray, gray.Bounds(), img, rect, draw.Src, nil)

	t := otsu(gray)
	dark := 0
	for _, p := range gray.Pix {
		if p < t {
			dark++
		}
	}
	// 文字は領域の中で少数派なので、暗い画素が多ければ暗い地に白字とみなして反転する。
	invert := dark > len(gray.Pix)/2
	for i, p := range gray.Pix {
		black := p < t
		if invert {
			black = !black
		}
		if black {
			gray.Pix[i] = 0
		} else {
			gray.Pix[i] = 255
		}
	}
	return pad(gray, 20*scale/3)
}

// otsu は判別分析法で2値化のしきい値を求める。
func otsu(g *image.Gray) uint8 {
	var hist [256]int
	for _, p := range g.Pix {
		hist[p]++
	}
	total := len(g.Pix)
	sum := 0
	for i, h := range hist {
		sum += i * h
	}
	var sumB, wB int
	best, threshold := 0.0, 0
	for i, h := range hist {
		wB += h
		if wB == 0 {
			continue
		}
		wF := total - wB
		if wF == 0 {
			break
		}
		sumB += i * h
		mB := float64(sumB) / float64(wB)
		mF := float64(sum-sumB) / float64(wF)
		if v := float64(wB) * float64(wF) * (mB - mF) * (mB - mF); v > best {
			best, threshold = v, i
		}
	}
	return uint8(threshold + 1)
}

// pad は周りに白い余白を足す。Tesseract は文字が画像の端に接していると読み落としやすい。
func pad(g *image.Gray, n int) *image.Gray {
	out := image.NewGray(image.Rect(0, 0, g.Bounds().Dx()+2*n, g.Bounds().Dy()+2*n))
	draw.Draw(out, out.Bounds(), &image.Uniform{color.Gray{255}}, image.Point{}, draw.Src)
	draw.Draw(out, g.Bounds().Add(image.Pt(n, n)), g, image.Point{}, draw.Src)
	return out
}

// Tesseract は画像を tesseract コマンドで読み取る。psm はページ分割の方式（7: 1行、6: 複数行の塊）。
func Tesseract(g *image.Gray, psm int, whitelist string) (string, error) {
	f, err := os.CreateTemp("", "cardimg-*.png")
	if err != nil {
		return "", err
	}
	defer os.Remove(f.Name())
	if err := png.Encode(f, g); err != nil {
		f.Close()
		return "", err
	}
	f.Close()

	args := []string{f.Name(), "stdout", "-l", "eng", "--psm", strconv.Itoa(psm)}
	if whitelist != "" {
		args = append(args, "-c", "tessedit_char_whitelist="+whitelist)
	}
	var out, stderr bytes.Buffer
	cmd := exec.Command("tesseract", args...)
	cmd.Stdout, cmd.Stderr = &out, &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract: %v: %s", err, stderr.String())
	}
	return strings.TrimSpace(out.String()), nil
}

var (
	reCode           = regexp.MustCompile(`(\d{2})-?(\d{3})-?([A-Z]{1,2})(\d{3})`)
	reCodeSerieDigit = regexp.MustCompile(`\d{2}-\d{3}-[10]\d{3}`)
)

// ParseCode は読み取った文字列からカード番号を取り出す。
func ParseCode(s string) (string, bool) {
	s = strings.ReplaceAll(strings.ToUpper(s), " ", "")
	// 記号の位置（自治体コードの後ろ）には英字しか来ないので、そこで読まれた 1 と 0 は I と O とみなす。
	s = reCodeSerieDigit.ReplaceAllStringFunc(s, func(m string) string {
		return m[:7] + strings.NewReplacer("1", "I", "0", "O").Replace(m[7:8]) + m[8:]
	})
	m := reCode.FindStringSubmatch(s)
	if m == nil {
		return "", false
	}
	return fmt.Sprintf("%s-%s-%s%s", m[1], m[2], m[3], m[4]), true
}

// Coord は度分秒から求めた十進の緯度経度。
type Coord struct {
	Lat, Lng float64
	Text     string // 度分秒の表記（例: 35°44'16.6"N 139°47'06.7"E）
}

var (
	reLat = regexp.MustCompile(`(\d{2})\D{1,3}(\d{2})\D{1,3}(\d{2})[.,](\d)`)
	reLng = regexp.MustCompile(`(1\d{2})\D{1,3}(\d{2})\D{1,3}(\d{2})[.,](\d)`)
)

// ParseCoord は読み取った2行の文字列から、度分秒の緯度と経度を取り出す。
// 日本の範囲（北緯 20〜46 度、東経 122〜154 度）と、分と秒が 60 未満であることを確かめる。
func ParseCoord(s string) (Coord, error) {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	var latLine, lngLine string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		switch {
		case l == "":
		case latLine == "":
			latLine = l
		case lngLine == "":
			lngLine = l
		}
	}
	lat := reLat.FindStringSubmatch(latLine)
	lng := reLng.FindStringSubmatch(lngLine)
	if lat == nil || lng == nil {
		return Coord{}, fmt.Errorf("度分秒として読めない: %q", s)
	}
	la, err := dms(lat[1:])
	if err != nil {
		return Coord{}, err
	}
	lo, err := dms(lng[1:])
	if err != nil {
		return Coord{}, err
	}
	if la < 20 || la > 46 || lo < 122 || lo > 154 {
		return Coord{}, fmt.Errorf("日本の範囲外: %f, %f", la, lo)
	}
	text := fmt.Sprintf(`%s°%s'%s.%s"N %s°%s'%s.%s"E`, lat[1], lat[2], lat[3], lat[4], lng[1], lng[2], lng[3], lng[4])
	return Coord{Lat: la, Lng: lo, Text: text}, nil
}

func dms(p []string) (float64, error) {
	d, _ := strconv.Atoi(p[0])
	m, _ := strconv.Atoi(p[1])
	s, _ := strconv.Atoi(p[2])
	t, _ := strconv.Atoi(p[3])
	if m >= 60 || s >= 60 {
		return 0, fmt.Errorf("分か秒が 60 以上: %v", p)
	}
	return float64(d) + float64(m)/60 + (float64(s)+float64(t)/10)/3600, nil
}
