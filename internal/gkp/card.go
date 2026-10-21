package gkp

import (
	"fmt"
	"path"
	"regexp"
	"strings"
)

// IDSource はカード番号をどこから組み立てたかを表す。
type IDSource string

const (
	// IDFromTable は、表の市町村欄の記号（例: A001）と画像名の自治体コードから組み立てた番号。
	IDFromTable IDSource = "table"
	// IDFromImageName は、画像のファイル名だけから推定した番号。カード画像の印字で確かめる必要がある。
	IDFromImageName IDSource = "image-name"
	// IDUnknown は、番号を組み立てられなかったことを表す。
	IDUnknown IDSource = "unknown"
)

var (
	reCityCode   = regexp.MustCompile(`[(（]\s*([A-Z]{1,2}\d{3})\s*[)）]`)
	reImagePref  = regexp.MustCompile(`^(\d{2})-(\d{3})`)
	reImageSerie = regexp.MustCompile(`^\d{2}-\d{3}-([A-Z]{1,2})-?(\d{1,3})(?:\.|$)`)
)

// CardID は、カードに印刷された公式のカード番号（例: 13-100-A001）を組み立てる。
func CardID(r Row) (string, IDSource) {
	name := strings.TrimSpace(path.Base(r.ImageURL))
	m := reImagePref.FindStringSubmatch(name)
	if m == nil {
		return "", IDUnknown
	}
	prefix := m[1] + "-" + m[2]

	if c := reCityCode.FindStringSubmatch(fold(strings.Join(r.City, ""))); c != nil {
		return prefix + "-" + c[1], IDFromTable
	}
	if s := reImageSerie.FindStringSubmatch(name); s != nil {
		var n int
		fmt.Sscanf(s[2], "%d", &n)
		return fmt.Sprintf("%s-%s%03d", prefix, s[1], n), IDFromImageName
	}
	return "", IDUnknown
}

var prefNames = [...]string{
	"", "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
	"茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
	"新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
	"静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
	"奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
	"徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
	"熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
}

// PrefName は、カード番号や画像名の先頭2桁（都道府県コード）から都道府県名を返す。
// 00 は全国規模の団体（日本下水道事業団、UR 都市機構など）で、空を返す。
func PrefName(r Row) string {
	m := reImagePref.FindStringSubmatch(path.Base(r.ImageURL))
	if m == nil {
		return ""
	}
	var code int
	fmt.Sscanf(m[1], "%d", &code)
	if code <= 0 || code >= len(prefNames) {
		return ""
	}
	return prefNames[code]
}

// Status は GKP の掲載から読み取った配布状態。
type Status string

const (
	StatusActive    Status = "active"    // 配布中（停止や終了の記載がない）
	StatusSuspended Status = "suspended" // 一時中止
	StatusEnded     Status = "ended"     // 配布終了
)

var (
	reEnded     = regexp.MustCompile(`配布(?:を)?終了`)
	reSuspended = regexp.MustCompile(`(?:現在|只今|当面).{0,8}(?:中止|休止|停止|見合わせ)|一時(?:的に)?(?:中止|休止|停止)`)
)

// CardStatus は、配布場所、配布時間、在庫状況の欄の記載から配布状態を判定する。
func CardStatus(r Row) Status {
	text := strings.Join(append(append(append([]string{}, r.Place...), r.Hours...), r.Stock...), "\n")
	switch {
	case reEnded.MatchString(text):
		return StatusEnded
	case reSuspended.MatchString(text):
		return StatusSuspended
	}
	return StatusActive
}
