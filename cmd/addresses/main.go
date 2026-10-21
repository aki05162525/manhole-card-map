// addresses は保存済みの一覧ページから配布場所の住所を取り出し、ジオコーダーに渡す1行1住所のファイルにする。
// 都道府県名が省かれた住所には、カードの都道府県名を補う。重複する住所は1行にまとめる。
// 町名と番地の間の空白と、対応する開き括弧のない閉じ括弧は、ジオコーダーが住所を読み損ねるため取り除く。
//
//	go run ./cmd/addresses -list data/raw/gkp-list-YYYYMMDD.html -pref 13,27 -out data/work/addresses.txt
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

// source は、1つの住所がどのカードのどの配布場所から来たか。
type source struct {
	Index     int    `json:"index"`
	City      string `json:"city"`
	Place     int    `json:"place"` // カードの中での配布場所の番号（0 始まり）
	Name      string `json:"name"`
	Original  string `json:"original"` // 一覧に書かれた住所（都道府県を補う前）
	Borrowed  bool   `json:"borrowed"` // 隣の場所から補った住所か
	Condition string `json:"condition,omitempty"`
}

var (
	rePref       = regexp.MustCompile(`^(?:北海道|東京都|大阪府|京都府|\p{Han}{2,3}県)`)
	reSpaceDigit = regexp.MustCompile(`([^\d\s])\s+(\d)`)
)

// query はジオコーダーに渡す形にする。一覧に書かれた住所は出どころのファイルに残す。
func query(addr string) string {
	q := strings.Join(strings.Fields(addr), " ")
	q = reSpaceDigit.ReplaceAllString(q, "$1$2")
	if strings.Count(q, ")") > strings.Count(q, "(") {
		q = strings.TrimSpace(strings.TrimSuffix(q, ")"))
	}
	return q
}

func main() {
	list := flag.String("list", "", "保存済みの一覧ページの HTML")
	prefs := flag.String("pref", "", "対象の都道府県コード（2桁、カンマ区切り）。空ならすべて")
	out := flag.String("out", "data/work/addresses.txt", "1行1住所の出力先")
	flag.Parse()

	f, err := os.Open(*list)
	if err != nil {
		log.Fatal(err)
	}
	rows, err := gkp.ParseList(f)
	f.Close()
	if err != nil {
		log.Fatal(err)
	}
	want := map[string]bool{}
	for _, p := range strings.Split(*prefs, ",") {
		if p = strings.TrimSpace(p); p != "" {
			want[p] = true
		}
	}

	var order []string
	sources := map[string][]source{}
	for _, r := range rows {
		id, _ := gkp.CardID(r)
		if len(want) > 0 && (len(id) < 2 || !want[id[:2]]) {
			continue
		}
		res := gkp.ParsePlaces(r.Place)
		for i, p := range res.Places {
			if p.Address == "" {
				continue
			}
			for _, addr := range strings.Split(p.Address, " / ") {
				q := query(addr)
				if !rePref.MatchString(q) {
					q = gkp.PrefName(r) + q
				}
				if _, ok := sources[q]; !ok {
					order = append(order, q)
				}
				sources[q] = append(sources[q], source{
					Index: r.Index, City: strings.Join(r.City, " "), Place: i, Name: p.Name,
					Original: addr, Borrowed: p.AddressFrom != nil, Condition: p.Condition,
				})
			}
		}
	}

	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		log.Fatal(err)
	}
	w, err := os.Create(*out)
	if err != nil {
		log.Fatal(err)
	}
	bw := bufio.NewWriter(w)
	for _, q := range order {
		fmt.Fprintln(bw, q)
	}
	if err := bw.Flush(); err != nil {
		log.Fatal(err)
	}
	w.Close()

	b, _ := json.MarshalIndent(sources, "", "  ")
	srcPath := strings.TrimSuffix(*out, filepath.Ext(*out)) + "-sources.json"
	if err := os.WriteFile(srcPath, b, 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("住所 %d 件（重複を除く）: %s / 出どころ: %s\n", len(order), *out, srcPath)
}
