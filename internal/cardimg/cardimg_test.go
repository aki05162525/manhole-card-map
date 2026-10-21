package cardimg

import (
	"math"
	"testing"
)

func TestParseCode(t *testing.T) {
	tests := []struct {
		raw, want string
		ok        bool
	}{
		{"13-100-A001", "13-100-A001", true},
		{"13-100-A001 I", "13-100-A001", true},
		{"15-224-1001", "15-224-I001", true}, // 記号の I を数字の 1 と読んだ
		{"13-000-A001", "13-000-A001", true},
		{"AR-990-ANN1", "", false},
	}
	for _, tt := range tests {
		got, ok := ParseCode(tt.raw)
		if got != tt.want || ok != tt.ok {
			t.Errorf("ParseCode(%q) = %q, %v; want %q, %v", tt.raw, got, ok, tt.want, tt.ok)
		}
	}
}

func TestParseCoord(t *testing.T) {
	c, err := ParseCoord("35°44'16.6\"N\n139°47'06.7\"E")
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(c.Lat-35.737944) > 1e-5 || math.Abs(c.Lng-139.785194) > 1e-5 {
		t.Errorf("got %f, %f", c.Lat, c.Lng)
	}

	for _, bad := range []string{
		"34°34'33.3\"N\n185°28'14.3\"E", // 3 を 8 と読むと日本の範囲外になる
		"37°37'43.8\"N\n138°97'32.8\"E", // 分が 60 以上
		"39°46'53.1\"N",                 // 経度の行がない
	} {
		if _, err := ParseCoord(bad); err == nil {
			t.Errorf("ParseCoord(%q) にエラーが出ない", bad)
		}
	}
}
