package gkp

import (
	"regexp"
	"strings"
)

// Place は配布場所の欄から取り出した、1つの配布場所。
type Place struct {
	Condition string   `json:"condition,omitempty"` // 【平日】などの条件。なければ空
	Name      string   `json:"name"`
	Address   string   `json:"address,omitempty"`
	Phone     string   `json:"phone,omitempty"`
	Notes     []string `json:"notes,omitempty"`
	// AddressFrom は、住所を隣の場所から補った場合に、補った元の場所の番号（0 始まり）を持つ。
	// 同じ建物の別窓口（平日は担当課、休日は守衛室など）で、住所が一度しか書かれていないときに起きる。
	AddressFrom *int `json:"addressFrom,omitempty"`

	// ownPhone は、電話番号がこの場所のすぐ後ろに書かれていたかを表す。
	// 「電話：【平日】…」のように、後から条件で振り分けた番号では false のまま。
	ownPhone bool
}

// PlaceResult は配布場所の欄を解析した結果。
// 解釈できなかった点は Issues に残し、黙って捨てない。
type PlaceResult struct {
	Places  []Place  `json:"places"`
	Inquiry []string `json:"inquiry,omitempty"` // （問合せ先）以降の行
	Issues  []string `json:"issues,omitempty"`
}

// 解釈できなかった点の種類。集計のキーにもなる。
const (
	IssueNoPlace          = "配布場所が1つも取れない"
	IssueNoName           = "施設名がない"
	IssueNoAddress        = "住所がない"
	IssueManyAddresses    = "1つの場所に住所が複数ある"
	IssueUnclassifiedLine = "住所の後に分類できない行がある"
	IssueEmptyCondition   = "条件の見出しの後に場所がない"
)

var (
	reBracket   = regexp.MustCompile(`^【([^】]+)】\s*(.*)$`)
	reCircled   = regexp.MustCompile(`^([①-⑳])\s*(.*)$`)
	reMark      = regexp.MustCompile(`^[■◆●]\s*([^\s:]+):\s*(.*)$`)
	reInquiry   = regexp.MustCompile(`^[(【]?\s*(?:お?問い?合わ?せ先?|問合先|内容等?に関する)`)
	rePhoneHead = regexp.MustCompile(`^(?:電話|TEL|Tel|tel|☎|℡)\s*(?:番号)?\s*:?\s*`)
	rePhone     = regexp.MustCompile(`\d{2,5}-\d{1,4}-\d{3,4}`)
	reNote      = regexp.MustCompile(`^[※＊*]`)
	rePostal    = regexp.MustCompile(`^〒?\s*\d{3}-\d{4}\s*`)
	reAddrLabel = regexp.MustCompile(`^住所\s*:?\s*`)
	reDigit     = regexp.MustCompile(`\d`)
	reParen     = regexp.MustCompile(`\([^)]*\)`)
	rePrefHead  = regexp.MustCompile(`^(?:北海道|東京都|大阪府|京都府|\p{Han}{2,3}県)`)
	// 番地のない住所（例: 北海道天塩郡豊富町字温泉、北海道富良野市中五区）。
	reAddrNoNumber = regexp.MustCompile(`字|地先|[市郡]\p{Han}+[区町村]$`)
	// 住所の数字より前にあれば、住所ではなく施設名や窓口の案内とみなす語。
	// 例: 東大和市役所3階5番、高知県立美術館 1階、枚方市観光案内所Syuku56。
	reNotAddress = regexp.MustCompile(`役所|役場|窓口|階|案内所|センター|美術館|博物館|資料館|記念館|県庁|課|[A-Za-z]$`)
	// 都道府県名を省いた住所（例: 江別市東野幌本町6-43、南富良野町字幾寅505番地5）。
	reCityAddr = regexp.MustCompile(`^[\p{Han}\p{Hiragana}][\p{Han}\p{Katakana}\p{Hiragana}ヶケ]{0,7}?(?:市|区|町|村|郡)\S*?\d+\s*(?:丁目|番地|番|号|-|$)`)
	// 住所の数字部分（番地や丁目）。漢数字の丁目や番地も含める。
	reAddrNumber = regexp.MustCompile(`\d|[一二三四五六七八九十]+(?:丁目|番地?)|番地`)
	// 住所の直後に置かれる、建物名や階数の行。
	reAddrSuffix = regexp.MustCompile(`^\(|\d+\s*(?:階|F)\b|\d+\s*階|ビル|庁舎|会館|内$`)
	// 行の途中に現れる条件の見出し（例: 「電話：0165-34-2624【水曜のみ】剣淵町役場」）。
	// 電話番号や番地の数字の直後に限る。「ショッピングセンター内【けろりん堂】」のような施設名の一部は分けない。
	reInlineBracket = regexp.MustCompile(`([0-9０-９)）])(【[^】]+】)`)
	// ハイフンの異体字。長音記号（ー）は施設名に使われるため含めない。
	hyphens = strings.NewReplacer("‐", "-", "‑", "-", "‒", "-", "–", "-", "−", "-", "－", "-", "ｰ", "-")
)

// ParsePlaces は配布場所の欄の行から、配布場所を取り出す。
func ParsePlaces(lines []string) PlaceResult {
	var res PlaceResult
	var cur *Place
	afterAddress := false
	unclassified := false
	outer := ""         // 直前の【】見出し。①②がその下に並ぶ場合に条件をつなげる
	outerEmpty := false // 【】見出しの行に、見出し以外の中身がなかったか

	newPlace := func(cond string) {
		res.Places = append(res.Places, Place{Condition: cond})
		cur = &res.Places[len(res.Places)-1]
		afterAddress = false
	}

	lines = splitInline(lines)
	for i, line := range lines {
		f := hyphens.Replace(fold(line))
		if reInquiry.MatchString(f) {
			res.Inquiry = lines[i:]
			break
		}

		// 行頭の見出しを読む。「【平日】【休日】」や「①【水、木】」のように重なることがある。
		var brackets, circled []string
		for {
			if m := reBracket.FindStringSubmatch(f); m != nil {
				brackets, f = append(brackets, m[1]), strings.TrimSpace(m[2])
			} else if m := reCircled.FindStringSubmatch(f); m != nil {
				circled, f = append(circled, m[1]), strings.TrimSpace(m[2])
			} else {
				break
			}
		}
		if len(brackets)+len(circled) == 0 {
			if m := reMark.FindStringSubmatch(f); m != nil {
				brackets, f = []string{m[1]}, strings.TrimSpace(m[2])
			}
		}
		switch {
		case len(circled) > 0:
			cond := strings.Join(append(circled, brackets...), " ")
			if outerEmpty && len(brackets) == 0 {
				cond = outer + " " + cond // 【土日祝日】の下に①②が並ぶ場合
			}
			if cur != nil && isEmpty(*cur) {
				cur.Condition = cond // 中身のない【】見出しを①で置き換える
			} else {
				newPlace(cond)
			}
		case len(brackets) > 0 && cur != nil && isPhoneOnly(f):
			// 「【平日】0790-26-1018」のような、条件ごとの電話番号の行。新しい場所ではない。
			attachPhone(&res, cur, strings.Join(brackets, " "), f)
			continue
		case len(brackets) > 0:
			outer, outerEmpty = strings.Join(brackets, " "), f == ""
			newPlace(outer)
		}
		if f == "" {
			continue
		}
		if cur == nil {
			newPlace("")
		}

		switch {
		case reNote.MatchString(f):
			cur.Notes = append(cur.Notes, f)
		case rePhoneHead.MatchString(f) || (rePhone.MatchString(f) && !isAddress(f) && len([]rune(f)) <= 40):
			// 「電話：【平日】0564-22-0222」のように、電話番号に条件が付いている場合がある。
			phone := strings.TrimSpace(rePhoneHead.ReplaceAllString(f, ""))
			if m := reBracket.FindStringSubmatch(phone); m != nil {
				attachPhone(&res, cur, m[1], m[2])
			} else {
				attachPhone(&res, cur, "", phone)
			}
		case isAddress(f):
			if cur.Address != "" {
				addIssue(&res, IssueManyAddresses)
				cur.Address += " / " + cleanAddress(f)
			} else {
				cur.Address = cleanAddress(f)
			}
			afterAddress = true
		case !afterAddress:
			if name, addr, ok := splitNameAddress(f); ok && cur.Name == "" {
				cur.Name, cur.Address = name, addr
				afterAddress = true
				break
			}
			// 住所より前の行は施設名の一部とみなす（例: 施設名と、括弧書きの階数）。
			cur.Name = strings.TrimSpace(cur.Name + " " + f)
		case cur.Phone == "" && reAddrSuffix.MatchString(f):
			cur.Address += " " + f
		default:
			cur.Notes = append(cur.Notes, f)
			unclassified = true
		}
	}

	if unclassified {
		addIssue(&res, IssueUnclassifiedLine)
	}
	var kept []Place
	for _, p := range res.Places {
		if isEmpty(p) {
			addIssue(&res, IssueEmptyCondition)
			continue
		}
		kept = append(kept, p)
	}
	res.Places = kept
	if len(kept) == 1 && kept[0].Name == "" && kept[0].Condition != "" {
		// 「【大津市水再生センター】」のように、場所が1つだけで見出しが施設名になっている。
		kept[0].Name, kept[0].Condition = kept[0].Condition, ""
	}
	fillSharedAddresses(res.Places)
	for _, p := range res.Places {
		if p.Name == "" {
			addIssue(&res, IssueNoName)
		}
		if p.Address == "" {
			addIssue(&res, IssueNoAddress)
		}
	}
	if len(res.Places) == 0 {
		addIssue(&res, IssueNoPlace)
	}
	return res
}

// fillSharedAddresses は、住所のない場所に隣の場所の住所を補う。
// 「【平日】A課 【休日】守衛室 住所 電話」のように見出しが続いた後に住所が来る場合は後ろから、
// 「【平日】A課 住所 電話 【休日】守衛室」のように後ろの場所の住所が省かれた場合は前から補う。
func fillSharedAddresses(places []Place) {
	for i := range places {
		p := &places[i]
		if p.Address != "" || p.Name == "" {
			continue
		}
		from := -1
		if !p.ownPhone {
			// 住所も電話もない見出しが続いた先に、最初に現れる住所を使う。
			for j := i + 1; j < len(places); j++ {
				if places[j].Address != "" {
					from = j
					break
				}
				if places[j].ownPhone {
					break
				}
			}
		}
		if from < 0 && i > 0 && places[i-1].Address != "" {
			from = i - 1
		}
		if from >= 0 {
			p.Address = places[from].Address
			p.AddressFrom = &from
		}
	}
}

// splitInline は、行の途中にある【】見出しの前で行を分ける。
func splitInline(lines []string) []string {
	var out []string
	for _, l := range lines {
		for _, part := range strings.Split(reInlineBracket.ReplaceAllString(l, "$1\n$2"), "\n") {
			if part = strings.TrimSpace(part); part != "" {
				out = append(out, part)
			}
		}
	}
	return out
}

// splitNameAddress は「福井市水道記念館 福井市足羽1丁目7-35」のように、
// 1行に施設名と住所が空白区切りで並んでいる行を分ける。
func splitNameAddress(f string) (name, addr string, ok bool) {
	fields := strings.Fields(f)
	for i := 1; i < len(fields); i++ {
		if rest := strings.Join(fields[i:], " "); isAddress(rest) {
			return strings.Join(fields[:i], " "), rest, true
		}
	}
	return "", "", false
}

// attachPhone は電話番号を場所に付ける。条件が付いていれば、同じ条件の場所に付ける。
func attachPhone(res *PlaceResult, cur *Place, cond, phone string) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return // 「電話：」だけの行。番号は次の行以降に条件付きで並ぶ
	}
	target := cur
	if cond != "" {
		target = nil
		for k := range res.Places {
			if res.Places[k].Condition == cond {
				target = &res.Places[k]
				break
			}
		}
		if target == nil {
			target, phone = cur, cond+" "+phone
		}
	}
	if target == cur && cond == "" {
		target.ownPhone = true
	}
	if target.Phone != "" {
		target.Phone += " / "
	}
	target.Phone += phone
}

// isPhoneOnly は、行が電話番号（と括弧書きの補足）だけでできているかを判定する。
func isPhoneOnly(f string) bool {
	if !rePhone.MatchString(f) {
		return false
	}
	rest := rePhone.ReplaceAllString(rePhoneHead.ReplaceAllString(f, ""), "")
	return strings.TrimSpace(reParen.ReplaceAllString(rest, "")) == ""
}

func cleanAddress(folded string) string {
	return reAddrLabel.ReplaceAllString(rePostal.ReplaceAllString(folded, ""), "")
}

func isAddress(folded string) bool {
	s := cleanAddress(folded)
	head := s
	if loc := reDigit.FindStringIndex(s); loc != nil {
		head = s[:loc[0]]
	}
	if reNotAddress.MatchString(head) {
		return false
	}
	if rePrefHead.MatchString(s) {
		// 「岩手県指定有形文化財…」のような、都道府県名で始まる施設名を除く
		return reAddrNumber.MatchString(s) || reAddrNoNumber.MatchString(s)
	}
	return reCityAddr.MatchString(s)
}

func isEmpty(p Place) bool {
	return p.Name == "" && p.Address == "" && p.Phone == "" && len(p.Notes) == 0
}

func addIssue(res *PlaceResult, issue string) {
	for _, i := range res.Issues {
		if i == issue {
			return
		}
	}
	res.Issues = append(res.Issues, issue)
}
