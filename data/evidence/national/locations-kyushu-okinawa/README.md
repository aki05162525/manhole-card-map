# 九州・沖縄 配布施設位置の追補調査

2026-11-05。対象は既存 `data/overrides/regions/kyushu-okinawa.json` の未位置130施設。既位置7施設は対象外。

- **65施設**について建物・施設の公式目的地座標を追加。
- **65施設**は実際に調べた別の施設案内・アクセス・自治体公開データと個別理由を記録して未解決。
- 元地域監査で配布関係未確認の18件は別ファイルに保存。うち南山手地区町並み保存センター1件に建物座標候補を記録したが、配布確定や本体の更新には含めない。
- 本体の全130 facilityIdはupdates/unresolvedのいずれか一方にあり、重複・脱落なし。

## 引き渡し

`data/national/location-updates/kyushu-okinawa.json` が統合用。元fragment、地域監査、共有入力、Go/UIは変更していない。コミット・ブランチ操作なし。

`coordinate-proof.json` は各更新の施設名・住所、実際のCSV行、KML Placemark、HTML原文数値、公式リンク起点等の照合記録。
`unresolved-research.json` は未解決施設の個別根拠原本参照。
`unconfirmed-distribution-candidates.json` は配布関係未確認18件（legacyPlaceId付き）。
`validation.json` は網羅性・ハッシュ検査結果。

## 原本と再現

`manifest.json` はこの追補作業で実際に取得した234 URLの取得日時・最終URL・原本SHA256。保存ファイルの拡張子が `.html` でも、Content-TypeとbytesがCSV・ZIP・JSONの場合がある。原本bytesは改変していない。

`referenced-snapshots.json` は再利用した旧原本を含む参照一覧。元地域のmanifestにある同一URLは再取得せず、その原本パスを参照。検査した原本319個のSHA256一致。HTTP取得はhost単位で約1秒を空け、TLS検証を無効化していない。

- BODIKの自治体・県公開CSVは `selected-resources.json` にdataset、公開主体、resourceを保存。全体メタデータもAPI原本として保存。
- 沖縄県公式GISは原ZIP内のKML Point、または公式CSVのX=経度/Y=緯度を使用。座標軸順を入れ替えている。
- 短縮Google地図リンクは公式配布・施設ページに同じリンクがあることを確認し、解決先原本の目的地 `!3d/!4d` と照合。起点原本とハッシュをverificationMethodにも記録。
- ミクニワールドスタジアムは公式アクセスiframeの `!2z` が明示する度分秒目的地ラベルを復号し十進度に変換。viewportの `!2d/!3d` は使わない。
- 水の科学館の県CSV住所は八景水谷まで。施設運営者アクセスの同名施設・八景水谷1丁目11-1と追加照合。
- CSVの行番号はヘッダー=1の論理レコード番号。引用符内改行を含む物理行番号ではない。同じdatasetに複数resourceがあるため、sourceUrlを必ず優先して読む。

ローカルで再生成・検査する場合は以下。通信は発生しない。

```sh
python data/evidence/national/locations-kyushu-okinawa/build_updates.py
python data/evidence/national/locations-kyushu-okinawa/finalize.py
```

## 意図的に保留した主な点

- 古賀市上下水道庁舎、小林市第2別館、処理場管理棟などは、本庁・敷地全体の点で代用しない。
- 那珂川市下水道課は安徳702-1で、本庁の西隈1-1-1とは別。
- 徳之島町役場は施設詳細の旧点と新住所亀津7203の整合未確認。移転は採用せず、別担当向けメモとして残した。
- 太宰府館は元fragmentの施設そのものの建物座標を追加。臨時移転先への変更をこの追補では行っていない。
- 枕崎駅前案内所の公式リンク先は道路、北谷博物館の公式リンク先は伊平1丁目の区域。数値があっても建物目的地点ではないため不採用。
- ひがさすの県観光案内は干潟と施設を一緒に示す目的地。建物の点か確認不足で保留。
- 沖縄観光情報センターは県GISのカフーナA街区住所と配布先住所の差を未解決として保留。

すべてAIによる原典照合で、現地確認・人間確認ではない。採用した座標も建物・施設の代表目的地であり、室内窓口や階の位置を確定するものではない。ドキュメントとコードの仕様不一致はこの作業で発見していない。
