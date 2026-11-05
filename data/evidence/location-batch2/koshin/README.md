# 甲信・第2弾の証拠

`facts.json` は原本の事実抽出、`retrievals.json` は取得URL・UTC・bytes hash・失敗記録。一般HTML/PDF/画像/Shape原本は `data/work/location-batch2/koshin/` に保持し、Gitへ再配布しない。clean checkoutではこれらの原本bytesを再検証できない。原文全文の再配布許諾と数値の利用判断は分ける。

## 公開した原本と加工

- `ueda-tourism.csv`: 上田市「観光施設一覧」、市カタログ2026-10-03更新、CC BY 4.0。出典: <https://www.city.ueda.nagano.jp/soshiki/tokei/138127.html>、原本: <https://www.city.ueda.nagano.jp/uploaded/attachment/86227.csv>。取得bytesを無改変保存（CP932）。NO=65の数値・名称・住所を事実抽出した。CRS・作成方法・精度は未記載であり、建物座標として採用しない。
- `ueda-tile.pbf.gz`: 国土地理院最適化ベクトルタイル（PMTiles版、z16/x57946/y25635）。出典: <https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles>。2026-07-01更新表記、今回取得UTCとRange/hashは `vector-retrievals.json`。対象地域のタイルを抽出し、`BldA`外形から診断用重心を加工した。
- GSI公式説明は最適化Vectorを基本測量成果と位置付けない試験公開と明記する。PDL1.0の出典・加工表示を適用。ラスタと同じ条件とは推定しない。今回README取得成功、規約再取得はTLS互換エラーだったため、既保存 `data/evidence/location-batch1/gsi-terms.html` と取得記録を読み直した。旧取得UTC/hashを `facts.json` に明示し、新取得と扱わない。
- 松本市入口のCC BY4.0、LinkDataの個別CC BY3.0、一般GIS背景地図の利用条件は別物。今回、松本の原本はworkのみとした。公開点がGoogle由来と確認されたわけではないが、作成方法は未確認。

## 診断計算の限界

`vector-inputs.json` の外形選択は、上田CSV点を内包する外形を探した診断であり、夢工房の建物同定を証明しない。隣接する旧直売所との独立配置照合が未完のため、`derived-points.json` の点は未承認。上田は診断のみ。他の4IDは別の配置図照合を根拠に仮統合し、独立再レビュー待ち。

GSI数値はJGD2011地理座標・Web Mercatorタイル格子。x/yからlng/latへ逆投影し、lat/lngキーへ格納する。WGS84への測地系変換は行わない。穴を含めたPolygon重心を検査し、外になる中央市ではrepresentative_pointを使う。7桁丸め後の内包も検査する。小数7桁は出力精度であり、測量精度ではない。一般化・現況との差・棟同定の不確かさは残る。

```sh
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/koshin/derive.py
mise exec -- python3 -B data/evidence/location-batch2/koshin/verify.py
# 今回のローカル原本を保持したworktreeのみ
mise exec -- python3 -B data/evidence/location-batch2/koshin/verify.py --with-work
```

`verify.py` は自地域batch2選択を除去して開始manifest hashを検証する。後続地域がmanifestを更新した場合は当PRのcommitで再現する。継続的な全国採用件数テストを置換するものではない。

## 再調査で追加した証拠

`building-comparison.json` に諏訪・中央市・千曲の原図と外形の独立比較、南館の保留理由、旧取得日の原本再利用を記録。GSIのPBFは上田を含め8タイル（千曲は周囲配置と境界確認のため4タイル）。取得Range/UTC/hashは `vector-retrievals.json`。全て同じ試験公開PDL1.0に従い、国土地理院最適化ベクトルタイルを加工して作成した。

松本2点のcontains/最近傍距離は `matsumoto-comparison.json`、上田CSV NO65の実内包は `derived-points.json`。CRS不明のCSV点内包を棟同定の独立根拠にしない。上田市カタログのCC BY4.0は確認済みだが、別リンクの利用規約PDFは未取得。

```sh
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/koshin/check_comparison.py
```
