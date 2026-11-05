# 東北・第2弾の証拠

HTML/PDF/写真は再配布条件を確認していないため、原本を `data/work/location-batch2/tohoku/` に保持し、Gitには `retrievals.json` のURL・UTC取得日時・hashと `facts.json` の事実抽出だけを置く。取得失敗も記録する。`reuseFrom` がある行は旧原本のhashを確認したコピーで、新取得ではない。原本の確認日は書き換えていない。

3個のPBFは国土地理院最適化ベクトルタイルPMTilesの必要範囲。出典：国土地理院最適化ベクトルタイル（https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles）。`vector-inputs.json` はBldAを抽出して作成し、`derived-comparisons.json` は比較用重心を算出した加工物で、国土地理院作成の施設座標ではない。採用0、建物同定未承認。

試験公開の位置付けは公式README Git `c0e37e155f7773a2940fb1c2ad3da01cc6a29c90`、利用は国土地理院コンテンツ利用規約（PDL1.0・出典/加工表示・第三者権利等の留保）による。基本測量成果に位置付けないというVector固有の説明を使い、標準ラスタの利用条件をそのまま当てはめていない。規約の直接取得はTLSエラーとなったため、batch1の保存原本をhash照合して再利用し、Web読取でも本文を確認した。

版はREADME記載の2026-07-01。PMTiles Range取得のURL、Range、時刻、hash、ETag、Last-Modifiedは `vector-retrievals.json`。個別建物の測量日は不明。MVT BldA extent=4096、y下向き、XYZタイルを逆Web Mercator式で経緯度へ変換する。地理院タイル仕様は国内JGD2011と説明している。測地系変換はしない。小数7桁は保存形式であり測量精度ではない。

```sh
mise exec -- python3 -B data/evidence/location-batch2/tohoku/verify.py
# 原本があるこのworktreeでのみ:
mise exec -- python3 -B data/evidence/location-batch2/tohoku/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/tohoku/derive.py
```

`derive.py` はPBF hash・元feature全体・有効外形・重心内包・丸め後内包を検査する。出力を `derived-comparisons.json` と比較する。外形内に点があることを、施設と外形の対応の証明にしていない。範囲探索のヒントは石巻の旧市marker付近、男鹿の旧Google q付近、花巻市役所付近の丸めた経緯度。Google座標を採用値にしていない。男鹿は1タイルの検討であり、周辺全タイルを調べたとは主張しない。
