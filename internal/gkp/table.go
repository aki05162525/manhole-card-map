// Package gkp は GKP「マンホールカード検索」ページの一覧表を解析する。
package gkp

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// Row は一覧表の1行（カード1枚）を、セルごとの行の並びとして保持する。
// 解釈は加えず、<br> で区切られた行をそのまま残す。
type Row struct {
	Index    int      // 表の中での順番（0 始まり）
	Pref     string   // 都道府県（rowspan の見出しから引き継ぐ）
	City     []string // 市町村（例: ["東京23区", "（A001）"]）
	ImageURL string
	Dan      string   // 弾数（例: "第05弾"）
	Issued   string   // 発行年月日（例: "2017/08/01"）
	Place    []string // 配布場所
	Hours    []string // 配布時間
	Stock    []string // 在庫状況
	Links    []string // 配布場所と在庫状況のセルにあるリンク先
}

const tableColumns = 7

// ParseList は一覧ページの HTML から、カードの行をすべて取り出す。
func ParseList(r io.Reader) ([]Row, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return nil, err
	}
	table := find(doc, func(n *html.Node) bool {
		return n.DataAtom == atom.Table && hasClass(n, "table1")
	})
	if table == nil {
		return nil, errors.New("一覧表（table.table1）が見つからない")
	}

	var rows []Row
	pref := ""
	for _, tr := range findAll(table, func(n *html.Node) bool { return n.DataAtom == atom.Tr }) {
		var tds []*html.Node
		for c := tr.FirstChild; c != nil; c = c.NextSibling {
			switch c.DataAtom {
			case atom.Th:
				if t := strings.Join(cellLines(c), ""); t != "" && len(tds) == 0 {
					pref = t
				}
			case atom.Td:
				tds = append(tds, c)
			}
		}
		if len(tds) == 0 {
			continue // 見出し行
		}
		if len(tds) != tableColumns {
			return nil, fmt.Errorf("%d 行目: 列数が %d（想定は %d）", len(rows)+1, len(tds), tableColumns)
		}
		row := Row{
			Index:  len(rows),
			Pref:   pref,
			City:   cellLines(tds[0]),
			Dan:    strings.Join(cellLines(tds[2]), ""),
			Issued: strings.Join(cellLines(tds[3]), ""),
			Place:  cellLines(tds[4]),
			Hours:  cellLines(tds[5]),
			Stock:  cellLines(tds[6]),
		}
		if img := find(tds[1], func(n *html.Node) bool { return n.DataAtom == atom.Img }); img != nil {
			row.ImageURL = attr(img, "src")
		}
		for _, td := range []*html.Node{tds[4], tds[6]} {
			for _, a := range findAll(td, func(n *html.Node) bool { return n.DataAtom == atom.A }) {
				if href := strings.TrimSpace(attr(a, "href")); href != "" {
					row.Links = append(row.Links, href)
				}
			}
		}
		rows = append(rows, row)
	}
	return rows, nil
}

// cellLines はセルの中身を <br> とブロック要素で区切り、空でない行の並びにする。
func cellLines(n *html.Node) []string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		switch {
		case n.Type == html.TextNode:
			b.WriteString(n.Data)
		case n.DataAtom == atom.Br:
			b.WriteByte('\n')
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if n.DataAtom == atom.P || n.DataAtom == atom.Div {
			b.WriteByte('\n')
		}
	}
	walk(n)

	var lines []string
	for _, l := range strings.Split(b.String(), "\n") {
		if l = cleanLine(l); l != "" {
			lines = append(lines, l)
		}
	}
	return lines
}

func find(n *html.Node, match func(*html.Node) bool) *html.Node {
	if match(n) {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if f := find(c, match); f != nil {
			return f
		}
	}
	return nil
}

func findAll(n *html.Node, match func(*html.Node) bool) []*html.Node {
	var out []*html.Node
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if match(n) {
			out = append(out, n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return out
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func hasClass(n *html.Node, class string) bool {
	for _, c := range strings.Fields(attr(n, "class")) {
		if c == class {
			return true
		}
	}
	return false
}
