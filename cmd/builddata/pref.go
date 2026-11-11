package main

import (
	"fmt"
	"strings"
)

func assignPinPrefs(d *Data) error {
	prefs := strings.Fields("北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県")
	valid := map[string]bool{}
	for _, p := range prefs {
		valid[p] = true
	}
	cards := map[string]string{}
	for _, c := range d.Cards {
		cards[c.ID] = c.Pref
	}
	addresses := map[string]string{}
	for _, p := range d.Places {
		addresses[p.ID] = p.Address
	}
	for i := range d.Pins {
		p := &d.Pins[i]
		pref := ""
		if p.Kind == "place" {
			for _, candidate := range prefs {
				if strings.HasPrefix(addresses[p.ID], candidate) {
					pref = candidate
					break
				}
			}
		}
		if pref == "" {
			candidates := map[string]bool{}
			for _, id := range p.CardIDs {
				if cards[id] != "" {
					candidates[cards[id]] = true
				}
			}
			if len(candidates) == 1 {
				for candidate := range candidates {
					pref = candidate
				}
			}
		}
		if pref != "" && !valid[pref] {
			return fmt.Errorf("pin %s: invalid prefecture %q", p.ID, pref)
		}
		if p.Kind == "place" && pref == "" {
			return fmt.Errorf("place %s: prefecture is missing or ambiguous", p.ID)
		}
		p.Pref = pref
	}
	return nil
}
