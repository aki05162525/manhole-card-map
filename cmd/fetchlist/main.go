// fetchlist は GKP のマンホールカード一覧ページ（全国）を1回だけ取得し、data/raw に保存する。
// 同じ日のファイルがあれば取得しない。解析の検証は保存したファイルで行い、GKP へ繰り返しアクセスしない。
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const listURL = "https://www.gk-p.jp/mhcard/?pref=zenkoku"

func main() {
	outDir := flag.String("out", "data/raw", "保存先のディレクトリ")
	force := flag.Bool("force", false, "同じ日のファイルがあっても取得し直す")
	flag.Parse()

	out := filepath.Join(*outDir, "gkp-list-"+time.Now().Format("20060102")+".html")
	if _, err := os.Stat(out); err == nil && !*force {
		fmt.Println("取得済みのため何もしない:", out)
		return
	}

	req, err := http.NewRequest(http.MethodGet, listURL, nil)
	if err != nil {
		log.Fatal(err)
	}
	req.Header.Set("User-Agent", "manhole-card-map/0.1 (personal project; fetches once per week)")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Fatalf("GKP の応答が %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(out, body, 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("保存した: %s (%d bytes)\n", out, len(body))
}
