# 北関東追補（2026-11-05、AI原典照合）

全9 proposal、初回未採用8関係、現GKPで指紋が変わった北関東7カードを個別に再読した。現地調査・電話確認・人による確認ではない。座標承認は追加していない。初回原本を再利用し、新しい取得は本ディレクトリのURL別JSONに時刻・応答・SHA256を記録。HTTP/TLS制限の回避はしていない。

成果:

- `data/overrides/proposals/kanto-north.json`: PlaceLedger。7施設定義・10関係（8 addition、初回未採用の既存2関係への承認）。既存施設の共用を優先した。
- `data/national/patches/kanto-north.json`: 既存地域台帳のexact old/new 13件。9 proposalの採否、未採用8関係の個別結論、7変更カードの再確認理由・新旧hash、調査URL・失敗履歴を含む。Goが直接読む形式ではない。
- `inspections.json`: 実際に再読した採用根拠と該当箇所。既存キャッシュを参照する証拠は元ディレクトリも必要。
- `verification.json`: 実Go一時統合後のhash・参照・条件・履歴・未解決維持の検査結果。

## 9 proposalの採否

1. 龍ケ崎B: 既存Aの下水道課へBの代替関係を追加。原提案の「街なか交流プラザ」は現市原典では「観光物産センター」。第23弾の定休日代替という原文を採用。第10弾の9～17時は流用しない。年始の市役所閉庁日と重なる場合も配布可否は要確認と明記。
2. 北茨城: 混在legacyを守衛室へ対応し、土日祝・年末年始のうち日曜開庁日を除く条件へ限定。第2・第4日曜の市民課窓口をaddition。両者9～17時、日曜開庁日は年末年始を除く。
3. 桜川A: 真壁庁舎2階水道お客様センター、平日9～16時をaddition。旧下水道課の終了根拠はないので終了・削除しない。
4. 宇都宮A: 建物見出し「上下水道局」のlegacyを既存2階経営企画課のaliasへ統合。平日条件を明示上書き。1階警備員室は別施設。**Goは元の関係行を残すため、経営企画課の同一card+facility行が2行になる。独立施設・独立窓口数として数えない。**
5. 沼田A: 水曜のテラス沼田4階上下水道経営課、8:30～17:15をaddition。既存5階観光交流課は維持。
6. 渋川A: 中央公民館の定期清掃時のみ、第二庁舎下水道課へaddition。代替先の時刻は明記なし。中央公民館の配布時間や庁舎営業時間を流用しない。
7. 邑楽B: 混在legacyを既存Aの2階都市計画課へ追加し、月火（祝日・年末年始を除く）8:30～17:15として承認。年末年始の1階休日受付も既存A施設を共用してaddition。施設増加なし。
8. 白岡: 仮設本庁舎商工観光課をaddition。市配布表を画像で再読し、月曜9～16:30（祝日・年末年始除外）を採用。市703・9089で部署と所在地を照合。市4701本文の味彩臨時休業時の代替条件も保持。旧窓口の終了は認定しない。
9. 川島: 役場1階上下水道課、平日9～17時（年末年始除外）をaddition。既存さまちか事務所・役場日直とは別実窓口。

分類は採用5件、条件上の未確定事項または旧関係保留を伴う採用4件。追加窓口の採用と旧窓口終了の確認を混同しない。

## 初回未採用8関係

北茨城休日混在・宇都宮見出し・邑楽B混在の3関係を解決。以下5関係は未承認のまま。

- 桜川旧下水道課: 現行ページには水道お客様センターを指定。旧窓口の改称・終了を独立に示す記述がない。
- 富岡旧韮塚製糸場: 初回市1474333379830のTLS insufficient securityを引き継ぎ、再試行でセキュリティを下げない。観光公式id=7679は施設案内で配布条件なし。別公式記事id=7160は検索上LOGet!CARDの別商品で、取得は404。県21100は県流域下水道カードの案内で富岡市カードの根拠ではない。市原典の検索索引は配布情報を示すが、取得原本不足のまま承認しない。
- 北本: 初回市14043の404と現カテゴリを再読。県kitamoto.htmlは発行有のみ、配布場所・在庫は市へ照会する記載。市観光協会machikan.comの「マンホール」検索も表示できるコンテンツなし。検索索引の2025年一時終了だけで休止を承認しない。
- 白岡味彩センター: 市1206・4701・3419は同一画像HP_MHC.jpgを参照し、画像は「午後9時30分から午後3時30分」。別原典候補の施設2018年記事?p=2271は、取得すると施設トップと同一SHA256で配布本文がない。検索索引の古い9:30～17時では現時刻を解決できず、午前への推測訂正をしない。
- 白岡旧市役所窓口: 仮設新窓口の現在地は確認できたが、旧GKPの窓口が旧本庁舎か一時移転先かを確定できず、当該旧カード配布窓口の終了根拠なし。

各行の実調査URL、既存取得日時、追加取得原本、個別理由はpatchesの`pendingRelationDecisions`。研究中の`kitamoto.net`は北本市観光協会の公式サイトではないと判明し、採用根拠には含めていない。正式な協会は`machikan.com`で再調査した。

## 現指紋7カード

矢板A、所沢A/B/C/D、日高B、ふじみ野Bだけを原典再読後に更新した。所沢Cは現GKPの17:30・水木休が市原典の17時・木祝年末年始休と異なるため市を採用。ふじみ野Bの役場代替は公式本文の「毎月第3月曜日」へ限定し、初回台帳の「ステラ・イースト休館日」全般という広い表現を訂正。祝日翌火曜まで配布するかは未確定で、推測拡張しない。

現GKPは`data/evidence/national/list-source/gkp-20261105.html`を再利用。取得日は11/5、秒単位時刻未記録。共通`quality.json`を書換えず、`builddata -review-list`を`/tmp/kanto-north-proposals-current`へ出して現在hashを得た。

## 親の統合手順

地域原本とproposalをそのまま同時投入するだけではalias訂正が反映されない。まずexact patchを**地域台帳の一時コピー**へ適用する。元地域fragmentとこの修正コピーを同時投入してはいけない。他担当の座標追補と競合した場合は施設の座標変更を保持して個別に統合し、old不一致を無視して全体上書きしない。

```sh
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 -out /tmp/kanto-north-proposals-current
python data/evidence/national/proposals-kanto-north/assemble.py
mkdir -p /tmp/kanto-north-proposals-fragments
python data/evidence/national/proposals-kanto-north/integrate.py /tmp/kanto-north-proposals-fragments/region.json
cp data/overrides/proposals/kanto-north.json /tmp/kanto-north-proposals-fragments/proposals.json
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments '/tmp/kanto-north-proposals-fragments/*.json' -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 -merged-places /tmp/kanto-north-proposals-merged.json -audit-out /tmp/kanto-north-proposals-audit -out /tmp/kanto-north-proposals-build
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments data/overrides/regions/kanto-north.json -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 -out /tmp/kanto-north-proposals-before
mise exec -- go run ./cmd/builddata -places /tmp/kanto-north-proposals-merged.json -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 -out /tmp/kanto-north-proposals-roundtrip
python data/evidence/national/proposals-kanto-north/verify.py
```

`-place-fragments`は単一glob。カンマ区切りの複数pathは受け付けず、一度その指定で失敗後、上記の専用ディレクトリに変更して成功した。検証済みの統合台帳は親の全地域mergeへ渡せるが、他地域作業中の台帳を本担当で書き換えてはいない。

統合前後とも1313カード。元地域のみとの比較で関係行は1725から1733（addition 8）、施設は1678から1682（実増4）。確認済み行は223から244（新規承認10＋見出しalias承認1＋変更hashの再承認10）。この数には既存pilotや重複原文行を含むため、北関東の独立実窓口数ではない。位置承認増加0、ピン数増加0。共通3入力は設計文書記載SHA256と一致。

元地域・他担当・Go/UI・共有入力は変更せず、commit/branch/push/PR・子エージェント起動もしていない。読み取った範囲にコードと設計文書の不一致はない。9提案の旧名称や既存台帳の条件訂正は上記に個別記録した。
