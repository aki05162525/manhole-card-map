// inspect は保存済みの一覧ページを解析し、技術検証のための集計を表示する。
// あわせて、行ごとの解析結果を JSON に書き出す。
//
//	go run ./cmd/inspect data/raw/gkp-list-YYYYMMDD.html
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

type result struct {
	Index    int             `json:"index"`
	Pref     string          `json:"pref"`
	City     string          `json:"city"`
	ID       string          `json:"id"`
	IDSource gkp.IDSource    `json:"idSource"`
	Status   gkp.Status      `json:"status"`
	ImageURL string          `json:"imageUrl"`
	Places   gkp.PlaceResult `json:"placeResult"`
	Raw      []string        `json:"rawPlace"`
}

func main() {
	out := flag.String("json", "data/work/inspect.json", "行ごとの解析結果の出力先")
	examples := flag.Int("examples", 3, "問題の種類ごとに表示する例の数")
	flag.Parse()
	if flag.NArg() != 1 {
		log.Fatal("使い方: inspect <一覧ページの HTML>")
	}

	f, err := os.Open(flag.Arg(0))
	if err != nil {
		log.Fatal(err)
	}
	rows, err := gkp.ParseList(f)
	f.Close()
	if err != nil {
		log.Fatal(err)
	}

	results := make([]result, len(rows))
	for i, r := range rows {
		id, src := gkp.CardID(r)
		results[i] = result{
			Index: r.Index, Pref: gkp.PrefName(r), City: strings.Join(r.City, " "),
			ID: id, IDSource: src, Status: gkp.CardStatus(r), ImageURL: r.ImageURL,
			Places: gkp.ParsePlaces(r.Place), Raw: r.Place,
		}
	}
	report(results, *examples)

	if err := os.MkdirAll(filepath.Dir(*out), 0o755); err != nil {
		log.Fatal(err)
	}
	b, _ := json.MarshalIndent(results, "", "  ")
	if err := os.WriteFile(*out, b, 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Println("\n行ごとの結果:", *out)
}

func report(results []result, examples int) {
	fmt.Println("== 全体")
	fmt.Println("行数:", len(results))

	fmt.Println("\n== カード番号")
	bySource := map[gkp.IDSource]int{}
	ids := map[string][]string{}
	for _, r := range results {
		bySource[r.IDSource]++
		if r.ID != "" {
			ids[r.ID] = append(ids[r.ID], r.City)
		}
	}
	fmt.Printf("表の記号から確定: %d / 画像名から推定（要確認）: %d / 組み立て不可: %d\n",
		bySource[gkp.IDFromTable], bySource[gkp.IDFromImageName], bySource[gkp.IDUnknown])
	var dup []string
	for id, cities := range ids {
		if len(cities) > 1 {
			dup = append(dup, fmt.Sprintf("%s %v", id, cities))
		}
	}
	sort.Strings(dup)
	fmt.Println("番号の重複:", len(dup))
	printSome(dup, examples)
	var unknown []string
	for _, r := range results {
		if r.IDSource == gkp.IDUnknown {
			unknown = append(unknown, r.City+" "+r.ImageURL)
		}
	}
	printSome(unknown, examples)

	fmt.Println("\n== 配布状態")
	byStatus := map[gkp.Status]int{}
	for _, r := range results {
		byStatus[r.Status]++
	}
	fmt.Printf("配布中: %d / 一時中止: %d / 配布終了: %d\n",
		byStatus[gkp.StatusActive], byStatus[gkp.StatusSuspended], byStatus[gkp.StatusEnded])

	fmt.Println("\n== 配布場所")
	byCount := map[int]int{}
	withCond, inferred := 0, 0
	for _, r := range results {
		for _, p := range r.Places.Places {
			if p.AddressFrom != nil {
				inferred++
				break
			}
		}
		byCount[len(r.Places.Places)]++
		for _, p := range r.Places.Places {
			if p.Condition != "" {
				withCond++
				break
			}
		}
	}
	var counts []int
	for c := range byCount {
		counts = append(counts, c)
	}
	sort.Ints(counts)
	for _, c := range counts {
		fmt.Printf("場所が %d か所: %d 枚\n", c, byCount[c])
	}
	fmt.Println("条件つきの場所を持つカード:", withCond)
	fmt.Println("住所を隣の場所から補ったカード:", inferred)

	fmt.Println("\n== 解釈できなかった点（カード単位）")
	byIssue := map[string][]result{}
	clean := 0
	endedEmpty := 0
	for _, r := range results {
		issues := r.Places.Issues
		if r.Status != gkp.StatusActive && len(r.Places.Places) == 0 {
			endedEmpty++ // 配布終了や一時中止のカードは配布場所の欄が空になりうるので、問題として数えない
			issues = nil
		}
		if len(issues) == 0 {
			clean++
		}
		for _, is := range issues {
			byIssue[is] = append(byIssue[is], r)
		}
	}
	fmt.Println("配布終了・一時中止のため配布場所が空（正常）:", endedEmpty)
	fmt.Printf("問題なし: %d / 問題あり: %d\n", clean, len(results)-clean)
	var issues []string
	for is := range byIssue {
		issues = append(issues, is)
	}
	sort.Slice(issues, func(i, j int) bool { return len(byIssue[issues[i]]) > len(byIssue[issues[j]]) })
	for _, is := range issues {
		fmt.Printf("\n[%s] %d 枚\n", is, len(byIssue[is]))
		for i, r := range byIssue[is] {
			if i >= examples {
				break
			}
			fmt.Printf("  - %s %s\n      %s\n", r.Pref, r.City, strings.Join(r.Raw, " | "))
		}
	}
}

func printSome(ss []string, n int) {
	for i, s := range ss {
		if i >= n {
			fmt.Printf("  …ほか %d 件\n", len(ss)-n)
			return
		}
		fmt.Println("  -", s)
	}
}
