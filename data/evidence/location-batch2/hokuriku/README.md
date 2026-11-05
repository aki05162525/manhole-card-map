# 北陸第2弾の証拠

一般HTML・PDF・写真の原本は `data/work/location-batch2/hokuriku/` のみに保持する。Gitには取得記録・事実抽出を保存する。404は原本確認済みとしない。原本のURL・取得UTC・hash・版・頁は `retrievals.json`、再照合分は `recheck-retrievals.json`、内容は `facts.json` を参照。輪島市と朝倉氏遺跡保存協会の著作権説明も確認し、原本は転載していない。

## Vectorの出典と条件

出典：[国土地理院最適化ベクトルタイル](https://github.com/gsi-cyberjapan/optimal_bvmap)、[PMTiles v1](https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles)。readme記載の2026-07-01版を2026-11-05にRange取得した。初回3枚と再照合10枚の `*.pbf.gz` はPMTilesから抽出した圧縮タイルで、地物の編集なし。z/x/y、extent、hashは `vector-observations.json` と `recheck-vector-inputs.json`。HTTP Range/ETag/Last-Modified、原bytes/hashは `vector-retrievals.json` と `recheck-vector-retrievals.json`。再照合では同一ETagをIf-Matchで要求し、既存のヘッダ・ディレクトリRangeは保存hashを確認して再利用、新しいタイルRangeは追加取得した。旧取得を新規取得としない。

公式readmeの「公開の位置づけ」によれば試験公開で基本測量成果ではない。[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)のPDL1.0、出典・加工表示に従う。規約原本は既存 `data/evidence/location-batch1/gsi-terms.html` を再利用し、旧取得時刻2026-11-05T10:46:50.392397+00:00、SHA256 `5388d2854a05f3e7b41cb980ecfb2de75b315de68e0d9c94b9334c11e580739e` を維持。今回取得したreadmeと区別する。ラスターの条件を推測適用したものではない。

MVTはextent=4096、x右/y下で復号し、XYZのWeb Mercator格子から経緯度へ逆投影（出力軸はlat/lng）。一般の地理院タイル仕様 `data/evidence/location-batch1/east/gsi-tile-spec.html` はJGD2011を記載するが、optbv固有の測地系適用根拠としては間接的である。今回取得した `optbv_dataspec.pdf` と `optbv_attribute.pdf` は地物・属性表で、測地系の明記を確認できなかった。以前の断定を撤回し、製品固有の適用確認を採用前の残件とする。測地系変換は行っていない。元図の一般化や更新遅延があり、現地精度は未検証。

探索点（旧P05、輪島marker、朝日/福井の旧観光ページJSON-LD）は近傍のタイル選定だけに使用し、包含だけで建物を同定しない。再照合の朝日は市の施設名付き航空写真・配置図・運営者の渡廊下説明、佐渡は竣工資料の平面形・床面積・道路・渡廊下と照合した。福井は建物群まで照合したが、窓口を含む個別棟は未確定。探索の旧数値は採用していない。

## 加工と代表点の検討

`compare-vector.py` は保存PBFのhashを検査して直接復号し、`building-comparisons.json` を再計算する。地物配列番号はこのhashのタイル内だけの番号であり、永続IDではない。佐渡idx31北と朝日idx116北を、細い渡廊下に対応する頂点間で区切った部分の重心を計算。区切り頂点・部分外形・重心・逆投影前後数値を保存した。床面積との比較は局所縮尺補正の概算で、屋根/編集外形と床面積の一致を主張しない。穴・境界外の重心を使わないこと、元外形による部分の被覆、6小数丸め後の部分/全外形の内包を検査する。境界までの距離も記録する。6小数は記録桁数で測位精度ではない。これは数値候補の再現であり、manifestへの採用ではない。

佐渡idx29とidx31の間の道路交差、佐和田P05四点のidx253内包も原数値から再計算する。佐和田の包含は棟同定の承認ではなく、四名称を区別できないという観察。ローカル確認図はBldAを橙塗り、地物番号と道路・注記を重ねた加工図で、国土地理院の公式図ではない。図・復号JSONはworkのみ。レビュアーの一時画像・概算を数値原典にしていない。

## 再検証と依存

`uv` は **mise.tomlの管理対象ではない追加の調査用依存**（使用版0.13.5）。外部導入が必要。`mise exec --` は既存のGo/Bun/Node環境を使うためで、uvやPythonをmiseが固定するという意味ではない。以下のVectorコマンドはuv側のPython 3.13.12、mapbox-vector-tile 2.2.0、shapely 2.2.0を明示する。取得作業には別途pmtiles 3.8.1、requests 2.34.2、確認図にはPillow 13.0.0を使用したが、保存証拠の再検証には不要。

リポジトリルートから実行する。

```sh
mise exec -- python3 -B data/evidence/location-batch2/hokuriku/verify.py
# このworktreeのignored原本・Rangeも検査
mise exec -- python3 -B data/evidence/location-batch2/hokuriku/verify.py --raw
mise exec -- uv run --no-project --python 3.13.12 --with mapbox-vector-tile==2.2.0 python data/evidence/location-batch2/hokuriku/check-vector.py
mise exec -- uv run --no-project --python 3.13.12 --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/hokuriku/compare-vector.py
```

`verify.py` は32施設の母集団、8選定、旧JSON pointer、取得参照、監査stage列挙、未採用を検査する。開始時manifestの原bytesを `baseline-manifest.json` に固定し、selection記録の旧hashと照合して歴史的608件を再assembleする。現manifestも別にassembleし、北陸32施設の全フィールド不変と現件数を検査する。他地域の採用だけでは608の期待値を書き換えない。全国の台帳全フィールド一致は現manifestが開始時hashと同じ場合に検査する。旧入力自体が変更された場合は固定hash検査が失敗するので、無条件に最新mainへ追随する検証器ではない。`--raw` は保存原本55ファイルのbytes/hashと開始時台帳も確認する。

`check-vector.py` は初回3タイル、`compare-vector.py` は追加10枚を含む13タイルを検査。第三者の再取得時に同じ内容を得られる保証ではなく、建物同定と現況の意味判断は独立レビューが必要。
