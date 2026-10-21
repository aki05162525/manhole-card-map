package gkp

import (
	"reflect"
	"strings"
	"testing"
)

// 各ケースは、2026-10-21 時点の GKP 一覧に実際にあった書き方を元にしている。
func TestParsePlaces(t *testing.T) {
	tests := []struct {
		name   string
		lines  string // " | " 区切り
		want   []Place
		issues []string
	}{
		{
			name:  "施設名、住所、電話の基本形と問合せ先",
			lines: "富谷宿観光交流ステーションとみやど | 宮城県富谷市富谷新町111-１ | 電話:022-347-3344 | （問合せ先） | 富谷市建設部上下水道課 | 電話:022-358-0529",
			want:  []Place{{Name: "富谷宿観光交流ステーションとみやど", Address: "宮城県富谷市富谷新町111-1", Phone: "022-347-3344"}},
		},
		{
			name:  "曜日で場所が分かれる",
			lines: "【平日】加西市生活環境部 上下水道課 | 兵庫県加西市北条町横尾1000 | 電話：0790-42-8760 | 【休日】加西市民会館 | 兵庫県加西市北条町古坂1-1 | 電話：0790-43-0160",
			want: []Place{
				{Condition: "平日", Name: "加西市生活環境部 上下水道課", Address: "兵庫県加西市北条町横尾1000", Phone: "0790-42-8760"},
				{Condition: "休日", Name: "加西市民会館", Address: "兵庫県加西市北条町古坂1-1", Phone: "0790-43-0160"},
			},
		},
		{
			name:  "後ろの場所の住所が省かれている（同じ建物の別窓口）",
			lines: "【平日】浦安市役所道路整備課（市役所6階） | 千葉県浦安市猫実1-1-1 | 電話:047-351-1111 | 【休日】浦安市役所守衛室（市役所1階）",
			want: []Place{
				{Condition: "平日", Name: "浦安市役所道路整備課(市役所6階)", Address: "千葉県浦安市猫実1-1-1", Phone: "047-351-1111"},
				{Condition: "休日", Name: "浦安市役所守衛室(市役所1階)", Address: "千葉県浦安市猫実1-1-1", AddressFrom: ptr(0)},
			},
		},
		{
			name:  "見出しが続いた後に住所と条件つきの電話番号が来る",
			lines: "【平日】市川町役場 下水道課 | 【休日】市川町役場 1階受付 | 兵庫県神崎郡市川町西川辺165-3 | 電話： | 【平日】0790-26-1018 | 【休日】0790-26-1010",
			want: []Place{
				{Condition: "平日", Name: "市川町役場 下水道課", Address: "兵庫県神崎郡市川町西川辺165-3", Phone: "0790-26-1018", AddressFrom: ptr(1)},
				{Condition: "休日", Name: "市川町役場 1階受付", Address: "兵庫県神崎郡市川町西川辺165-3", Phone: "0790-26-1010"},
			},
		},
		{
			name:  "行の途中に条件の見出しがある",
			lines: "【水曜日以外】絵本の館 | 北海道上川郡剣淵町緑町15-3 | 電話：0165-34-2624【水曜のみ】剣淵町役場 建設課窓口 | 北海道上川郡剣淵町仲町37-1",
			want: []Place{
				{Condition: "水曜日以外", Name: "絵本の館", Address: "北海道上川郡剣淵町緑町15-3", Phone: "0165-34-2624"},
				{Condition: "水曜のみ", Name: "剣淵町役場 建設課窓口", Address: "北海道上川郡剣淵町仲町37-1"},
			},
		},
		{
			name:  "【】の下に①②が並び、1行に施設名と住所がある",
			lines: "【土日祝日】 | ①福井市水道記念館 福井市足羽1丁目7‐35 | 電話:0776-35-6751 | ②福井市まちなか案内所 福井市中央1丁目2－1 | 電話:0776-20-5348",
			want: []Place{
				{Condition: "土日祝日 ①", Name: "福井市水道記念館", Address: "福井市足羽1丁目7-35", Phone: "0776-35-6751"},
				{Condition: "土日祝日 ②", Name: "福井市まちなか案内所", Address: "福井市中央1丁目2-1", Phone: "0776-20-5348"},
			},
		},
		{
			name:  "都道府県名で始まる施設名と、番地のない住所",
			lines: "岩手県指定有形文化財旧吉田家住宅主屋 | 岩手県陸前高田市気仙町字町裏200番8 | 電話:0192-22-8872",
			want:  []Place{{Name: "岩手県指定有形文化財旧吉田家住宅主屋", Address: "岩手県陸前高田市気仙町字町裏200番8", Phone: "0192-22-8872"}},
		},
		{
			name:  "市役所の階と窓口番号は住所ではない",
			lines: "【平日（祝日・年末年始を除く）】 | 東大和市役所3階5番 産業振興課窓口 | 東京都東大和市中央3-930",
			want:  []Place{{Condition: "平日(祝日・年末年始を除く)", Name: "東大和市役所3階5番 産業振興課窓口", Address: "東京都東大和市中央3-930"}},
		},
		{
			name:  "施設名の中の【】は区切りにしない",
			lines: "ショッピングセンターYO-TASHI内【けろりん堂】 | 福島県双葉郡川内村大字下川内字宮ノ下25-1",
			want:  []Place{{Name: "ショッピングセンターYO-TASHI内【けろりん堂】", Address: "福島県双葉郡川内村大字下川内字宮ノ下25-1"}},
		},
		{
			name:  "康熙部首の「⻑」で書かれた県名",
			lines: "岡谷蚕糸博物館 | ⻑野県岡谷市郷田1-4-8",
			want:  []Place{{Name: "岡谷蚕糸博物館", Address: "長野県岡谷市郷田1-4-8"}},
		},
		{
			name:   "期間限定の変更先は分類できない行として残す",
			lines:  "石ノ森萬画館 | 宮城県石巻市中瀬2番7号 | 電話:0225-96-5055 | ※令和8年10月19日から配布場所が下記に変更になります | 石巻市かわまち交流センター | 石巻市中央二丁目11番17",
			issues: []string{IssueManyAddresses, IssueUnclassifiedLine},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var lines []string
			for _, l := range strings.Split(tt.lines, " | ") {
				lines = append(lines, cleanLine(l))
			}
			got := ParsePlaces(lines)
			if !reflect.DeepEqual(got.Issues, tt.issues) {
				t.Errorf("issues = %v, want %v", got.Issues, tt.issues)
			}
			if tt.want == nil {
				return
			}
			for i := range got.Places {
				got.Places[i].ownPhone = false
			}
			if !reflect.DeepEqual(got.Places, tt.want) {
				t.Errorf("places =\n%+v\nwant\n%+v", got.Places, tt.want)
			}
		})
	}
}

func ptr(i int) *int { return &i }
