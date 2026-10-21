// fetchimages は、保存済みの一覧ページに載っているカード画像を取得し、data/raw/images に保存する。
// 1枚ずつ間隔を空けて取得し、保存済みの画像は取得しない。中断しても、同じコマンドで続きから再開できる。
//
//	go run ./cmd/fetchimages -list data/raw/gkp-list-YYYYMMDD.html -indices 0,32,64
//	go run ./cmd/fetchimages -list data/raw/gkp-list-YYYYMMDD.html -all
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aki05162525/manhole-card-map/internal/gkp"
)

func main() {
	list := flag.String("list", "", "保存済みの一覧ページの HTML")
	outDir := flag.String("out", "data/raw/images", "保存先のディレクトリ")
	indices := flag.String("indices", "", "取得する行の番号（0 始まり、カンマ区切り）")
	all := flag.Bool("all", false, "すべての行の画像を取得する")
	interval := flag.Duration("interval", time.Second, "取得の間隔")
	maxFailures := flag.Int("max-failures", 3, "取得の失敗がこの回数続いたら停止する")
	flag.Parse()
	if *list == "" || (*indices == "") == !*all {
		log.Fatal("使い方: fetchimages -list <HTML> (-indices 0,1,2 | -all)")
	}

	f, err := os.Open(*list)
	if err != nil {
		log.Fatal(err)
	}
	rows, err := gkp.ParseList(f)
	f.Close()
	if err != nil {
		log.Fatal(err)
	}

	targets := rows
	if !*all {
		targets = nil
		for _, s := range strings.Split(*indices, ",") {
			i, err := strconv.Atoi(strings.TrimSpace(s))
			if err != nil || i < 0 || i >= len(rows) {
				log.Fatalf("行の番号が不正: %q", s)
			}
			targets = append(targets, rows[i])
		}
	}
	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		log.Fatal(err)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	fetched, skipped, failed, streak := 0, 0, 0, 0
	for _, r := range targets {
		out := filepath.Join(*outDir, imageFileName(r.ImageURL))
		if _, err := os.Stat(out); err == nil {
			skipped++
			continue
		}
		if fetched+failed > 0 {
			time.Sleep(*interval)
		}
		if err := download(client, imageURL(r.ImageURL), out); err != nil {
			log.Printf("失敗: 行 %d %s: %v", r.Index, r.ImageURL, err)
			failed++
			if streak++; streak >= *maxFailures {
				log.Printf("失敗が %d 回続いたため停止する。同じコマンドで続きから再開できる", streak)
				break
			}
			continue
		}
		fetched++
		streak = 0
		fmt.Printf("取得 %d/%d: %s\n", fetched+skipped+failed, len(targets), out)
	}
	fmt.Printf("取得: %d / 保存済みのため省略: %d / 失敗: %d\n", fetched, skipped, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

// imageURL は一覧に載っている画像の URL を https にそろえる（一覧では http で書かれている）。
func imageURL(u string) string {
	return strings.Replace(strings.TrimSpace(u), "http://", "https://", 1)
}

// imageFileName は保存するファイル名。末尾に余計な "." が付いた画像名などもそのまま扱えるようにする。
func imageFileName(u string) string {
	name := strings.TrimRight(path.Base(strings.TrimSpace(u)), ".")
	if filepath.Ext(name) == "" {
		name += ".jpg"
	}
	return name
}

// download は一時ファイルに書いてから名前を変える。途中で止まっても、壊れた画像を保存済みと見なさない。
func download(client *http.Client, url, out string) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "manhole-card-map/0.1 (personal project; one image per second)")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("応答が %s", resp.Status)
	}
	tmp := out + ".part"
	w, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(w, resp.Body); err != nil {
		w.Close()
		os.Remove(tmp)
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, out)
}
