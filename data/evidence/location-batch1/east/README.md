# 静岡県10施設の調査証拠と候補座標

このディレクトリの候補は調査担当の提案であり、採用済みではない。最終判断は親の統合記録を参照する。

## 出典・利用条件

- `kosai-tourism.csv`: 湖西市「観光施設一覧」2025-08-14更新。`yaizu-public-facilities.csv`: 焼津市「地図取込用公共施設データ一覧」2024-03-29版。静岡県オープンデータの[利用規約](https://opendata.pref.shizuoka.jp/privacy.html)と各カタログのCC BY表示を確認した。[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)のもとで保存し、施設同定用の抜粋・照合に使用する。元座標のCRSは当該CSVに明記されていないため、これらをそのまま採用しない。
- `kosai-tile.pbf.gz` / `yaizu-tile.pbf.gz`: [国土地理院最適化ベクトルタイル](https://github.com/gsi-cyberjapan/optimal_bvmap)のPMTilesから対象タイルを切り出して保存。データ更新版はREADME記載の2026-07-01、取得は2026-11-05。両者を混同しない。READMEに試験公開・基本測量成果ではないことが明記されている。
- GSIの[現利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)はPDL1.0、出典・加工表示を要求する。親が保存した規約原本は[../gsi-terms.html](../gsi-terms.html)、取得記録は[../gsi-terms-retrieval.json](../gsi-terms-retrieval.json)。第三者・外部APIの権利留保を他資料に拡張しない。
- `gsi-vector-readme.md` と `gsi-tile-spec.html` は上記GSI資料。タイル仕様の国内測地系はJGD2011。WGS84変換を行ったとは主張しない。
- **出典表示**：国土地理院最適化ベクトルタイルを加工して本プロジェクトが作成。施設同定には湖西市「観光施設一覧」、焼津市「地図取込用公共施設データ一覧」（静岡県オープンデータ、CC BY 4.0）を利用。国土地理院・各市による本候補の承認ではない。

一般の施設HTML・パンフレット・外観写真は再配布条件未確認のため、原本をignored `data/work/location-batch1/east/` に保持する。ブラウザー用配信資産には混ぜない。原本hash・URL・取得日時は`retrievals.json`、追跡対象へコピーした原本は`tracked-sources.json`を参照。`.html`拡張子のwork原本にもCSV/XLSX/DOCX/画像が含まれるため、内容形式は取得記録のcontentTypeで判断する。

## 再現

```sh
uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch1/east/derive.py > /tmp/location-batch1-east-derived.json
cmp data/evidence/location-batch1/east/derived-points.json /tmp/location-batch1-east-derived.json
```

`derive.py`は保存タイルのhash、探索補助点を含む外形が一つだけであること、選択外形の一致、有効性、重心が外形内部であることを検査する。BldAのtile XY上の面積重心を逆Web Mercatorで経緯度へ戻す。精度は建物代表点で、7桁の丸めが実測精度を示すものではない。微小な投影歪み・原典の地図総描・建物同定の限界がある。入口・階・室内窓口の測量は行っていない。

PMTiles取得のrange応答は7件すべてHTTP206、要求長一致、同一ETag。`vector-retrievals.json`にrawバイト範囲・hashを保存した。抽出タイルは最終のrange応答と同じgzip bytesであり、ネットワークなしで再現できる。Vector metadataとHTTP range原本はworkに保持する。
