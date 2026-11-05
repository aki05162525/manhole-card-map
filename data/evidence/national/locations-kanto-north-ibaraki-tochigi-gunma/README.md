# 北関東・位置追補（茨城／栃木／群馬）

2026-11-05、AIによる公式原典照合。現地確認・人の確認ではない。

対象は `data/overrides/regions/kanto-north.json` のうち cardId 先頭08・09・10の関係に結び付く、coordinate未設定の施設106件。対象一覧は `targets.json`。結果は `data/national/location-updates/kanto-north-ibaraki-tochigi-gunma.json`（48 updates / 58 unresolved）。既存fragment、全国監査ファイル、配布条件、アプリには反映していない。

## 採用と精度

公式施設マップの明示Marker.position、施設名付きspotList、HTMLのMapInformations.markers、data-marker-lat/lng、数値q、目的地POI、町公式施設マップデータを採用。施設名と元施設の住所を照合した。建物・施設代表点であり、室内窓口・階・入口の精度は主張しない。同一庁舎の複数窓口には同じ建物点を割り当てた。牛久「いばらき自慢」は同じエスカード牛久建物内の出張所マーカーを建物代表点として採用し、同一窓口とは扱わない。

- `reviewed-decisions.json`: 採用施設ID、元住所、原典URL、抽出方式、座標、同定理由。
- `decisions.py`: 採用選択と個別未解決理由の再現用入力。
- `facility-research.json`: 全106施設の実調査URLと取得結果。広域アクセス等の除外対象も含む。
- `manifest.json`: 実取得URL、最終URL、取得日時、HTTP状態または取得エラー、bytesのパスとSHA-256。旧地域キャッシュ再利用には `cacheReusedFrom` を記録し、元の取得日時を保つ。新取得はホストごと約1.05秒間隔。403/TLS回避は行っていない。短縮地図が429となった後は回避・再試行しない。

座標のない施設についても配布記事だけで終えず、施設・運営団体のアクセス、自治体施設紹介、公共施設マップ等を追った。施設ごとの限界は成果の `unresolved.reason` と `attempts` に記録している。未解決は位置確定・条件承認を意味しない。My MapsのIDしかない資料、地図画像のみの資料等には追加調査余地がある。

## 採用しなかった紛らわしい点

- Google埋め込みpbの `!1m3!1d...!2d...!3d...` は表示中心として除外。施設名が埋め込まれていてもマーカー座標とは扱わない。ll、@viewport、住所文字列q、StreetView撮影地点も不使用。
- 高萩の市役所前交差点、宇都宮の清原工業団地等の蓋設置地を窓口へ流用しない。アクアワールドの県記事の地図も蓋設置節にあるため本追補では採用しない。
- 那珂市曲がり屋のリンク先は「一の関ため池親水公園」全体の点。玉村総合運動公園、雪入公園、水郷テニスコート、ららん藤岡も対象棟との対応を確定できず保留。
- 守谷の百合ケ丘2-2734-1は記事末尾の問い合わせ先上下水道事務所。大柏950-1の配布場所市役所へ転用しない。これは移転発見ではない。
- コテラスの元住所麻生419-1と白帆の湯公式の麻生421-3は同一建物と確定できず保留。
- ORIGAMIプラザは町の利用案内にある住所一致のmarkers[]を採用。県農村めぐりの数値q（36.433598,139.915131）は異なるため不採用。原典間の位置差として親へ引き継ぐ。
- 桐生は美原町の水道局と織姫町の本庁を分離。結城は中央町2-3の現庁舎、牛久は分庁舎、桜川は真壁／大和、さくらは卯の里／本庁を各々同定。

窓口追加・移転を確定したproposalはない。配布休止・終了等の記載は条件担当の領域であり、今回変更していない。文書とコードの不一致として新たに確認したものはない。

## 再現・検証

リポジトリルートで実行する。buildは保存済み原典のみを読み、再取得しない（uvの依存パッケージ解決は別）。

```sh
uv run --with requests --with beautifulsoup4 python data/evidence/national/locations-kanto-north-ibaraki-tochigi-gunma/build.py
python data/evidence/national/locations-kanto-north-ibaraki-tochigi-gunma/verify.py
```

buildで原典の目的地点指定から値を再抽出する。verifyで全106IDの完全網羅・重複なし・原施設に座標がないこと・全manifest bytesのSHA-256・採用座標と原典数値の一致・住所参照・AI表示を確認する。確認結果は `validation.json`。再buildではcheckedAtが更新される。

調査補助の *-queue.json、*.py、*-log.txt、各reportは追跡用であり、採用一覧はreviewed-decisions.jsonを正とする。manifestには探索で読んだ採用外ページも含む。GKP現原本の取得日は2026-11-05、秒単位時刻未記録という前提を継承するが、本追補の位置証拠にGKPの蓋座標は用いていない。
