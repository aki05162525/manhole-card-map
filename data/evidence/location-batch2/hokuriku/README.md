# 北陸第2弾の証拠

一般HTML・PDF・写真は再配布条件を確認できていないため `data/work/location-batch2/hokuriku/` のみに保持する。Gitには取得記録・自作の事実抽出を保存する。404は原本確認済みとしない。原本の取得UTC・hash・版・頁は `retrievals.json` と `facts.json` を参照。画像原本 `shoukouji-map.png` もworkのみ。

## Vectorの出典と条件

出典：[国土地理院最適化ベクトルタイル](https://github.com/gsi-cyberjapan/optimal_bvmap)、[PMTiles v1](https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles)。2026-07-01版を2026-11-05にRange取得した。3枚の `*.pbf.gz` はPMTilesから抽出した圧縮タイルで、地物の編集なし。z/x/y、extent、hashは `vector-observations.json`、HTTP Range/ETag/Last-Modifiedと原bytesのhashは `vector-retrievals.json` に保持する。取得したRangeを他のタイルへ流用していない。

公式readmeの「公開の位置づけ」によれば、試験公開で基本測量成果とは位置付けられていない。[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)のPDL1.0、出典・加工表示に従う。規約原本は既存 `data/evidence/location-batch1/gsi-terms.html` を再利用し、旧取得時刻2026-11-05T10:46:50.392397+00:00、SHA256 `5388d2854a05f3e7b41cb980ecfb2de75b315de68e0d9c94b9334c11e580739e` を維持する。今回新規取得したreadmeと区別する。ラスターの条件を推測適用したものではない。

地理座標はJGD2011、タイル格子はWeb Mercator、MVT内はx右・y下で復号。WGS84への測地系変換は行わない。source CRSの参照は既存 `data/evidence/location-batch1/east/gsi-tile-spec.html`。元地図の一般化や更新遅延があり、現地精度は未検証。探索点は旧P052点と輪島施設marker1点で、近傍の探索のみに使う。包含だけで建物を同定しない。今回代表点は派生していないため、重心・穴・丸め後内包の採用検査は非該当。

加工：ローカル確認図は国土地理院最適化ベクトルタイルのBldA外形を復号し、橙塗り、地物配列番号、青の探索点を重ねた自作図。国土地理院の公式図ではない。図・復号JSONはworkのみ。タイル境界で切れる建物の形を全体形として扱わない。

## 再検証

リポジトリルートから実行する。

```sh
mise exec -- python3 -B data/evidence/location-batch2/hokuriku/verify.py
# このworktreeのignored原本も検査する場合
mise exec -- python3 -B data/evidence/location-batch2/hokuriku/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 python data/evidence/location-batch2/hokuriku/check-vector.py
```

前者は32施設の母集団、8選定、旧JSON pointer、取得参照、未採用、現assemble、manifest hashを照合する。`--raw` は原本bytes/hash、探索数値、作業開始時台帳との全フィールド一致も検査する。第三者の再取得時に同じ内容を得られる保証ではなく、施設同定の意味判断は独立レビューが必要。
