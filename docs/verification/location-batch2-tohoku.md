# 東北の位置調査・第2弾（Issue #34）

基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83` の現manifestをassembleし、Issue24 snapshotの `originalRef` が東北原調査を指す59IDをbatch1 baselineと照合した。59IDすべて未位置で既採用の除外は0。全国台帳の未位置608は開始時の実測集合であり、生成全体の未位置施設数ではない。

[selection.json](../../data/national/location-batch2/tohoku/selection.json) を新規調査前に保存した。初ピン候補と移転・別棟の懸念を優先して8施設を選定し、残る50施設は今回後順、秋田市守衛室1施設はIssue20の既存保留を維持した。[全59IDの分類と除外理由](../../data/national/location-batch2/tohoku/coverage.json)、[分類集計](../../data/national/location-batch2/tohoku/classification.json)を参照。配布分類53 active・2 suspended・4 needs-reviewは保存snapshotの分類で、全件を新たにWeb確認した意味ではない。

結果は **8施設調査、代表点算出3、採用提案2（仮統合）、保留6**。独立再レビューは未完了で、承認済み採用数は0。花巻本館・山田情報棟を位置追補とlifecycle bindingで仮統合した。全台帳差分は2施設のcoordinate/evidence/locationReviewだけ、全関係と既存ピンは不変。仮統合後の地域未位置57、全国台帳未位置606を、開始時59/608と区別する。

| 施設 | 追加調査結果と停止・再開条件 |
| --- | --- |
| 石巻かわまち交流センター | 414の498.47㎡は資料463.04㎡に近く、417の294.34㎡より支持的。しかし2施設区画と3外形の所属・堤防側区切りを未確定。高解像度図等で再開。 |
| 道の駅おが | 実際に取得した資料は運営者写真。228/279と周辺219/161を比較したが背後棟と方位を同定できず保留。3111の用途を推測しない。 |
| チェリーランド | 写真の入口表示を確認。Vectorとの比較は未実施で資料確認段階。案内所を同定できる配置資料等で再開。 |
| 花巻新館 | 405/402/324の形状を比較したが細長い図だけで一意対応できず保留。本館との相対配置等で再開。 |
| 河北 紅花資料館物産館 | 図の物産館と県道285号側の配置を確認。Vector照合は未実施と明記。地理参照外形との対応で再開。 |
| あぶくま洞管理事務所 | 洞内図・貸出案内には管理棟外周の情報がなく保留。管理棟を同定する園地図等で再開。 |
| 花巻本館警備員室 | L字の向き、横棒厚比（図.33/396 .34）、南側398の開始位置（幅の.665）を照合。脚幅の差も明記。396の共通横棒内の重心を提案。敷地図や入口測量を形式的必須にしない。 |
| 道の駅やまだ情報棟 | PDF2頁の北矢印、3方向の道路、南西販売棟126/北東情報棟127、127東側切欠きを照合。町の現配布案内も情報棟を明記。127の重心を提案。 |

[比較の肯定根拠と限界](../../data/evidence/location-batch2/tohoku/building-comparisons.json)、[再計算可能な外形・面積](../../data/evidence/location-batch2/tohoku/shape-measurements.json)を保存した。

| 提案施設ID | 代表点 lat,lng | binding |
| --- | --- | --- |
| facility:north-db757b448c8db73422a5 | 39.3885493,141.1168429 | location-lifecycle.json の同ID |
| facility:north-e2dfc05c8b1db51fc65b | 39.478372,141.9535192 | location-lifecycle.json の同ID |

bindingと位置追補は `data/national/location-batch2/tohoku/`。元行の旧値とhashは `previous-places.json`、manifestは2行とbindingファイルhashを明示選択する。

詳細なID・出典・停止再開条件は [outcomes.json](../../data/national/location-batch2/tohoku/outcomes.json)、原本URL・日時・hashは [retrievals.json](../../data/evidence/location-batch2/tohoku/retrievals.json)、ページ単位の事実は [facts.json](../../data/evidence/location-batch2/tohoku/facts.json) にある。

石巻の旧住所競合はIssue26で訂正済みで、今回未解決なのは建物外形との対応。旧P05点や市markerを採用値へ流用しない。花巻2施設は本館と新館を区別し、同住所を同棟の証明にしない。batch1の東2候補保留と同様に、ヒント点を含む外形を選べるだけでは同定済みにしない。Issue20/25/26/27およびbatch1 integration/followupsの保留条件を変更していない。

原本HTML/PDF/写真は `data/work/location-batch2/tohoku/` のみに保持。Gitには事実抽出と取得hashを収録した。明示条件を確認した試験Vector4タイルのみ証拠へ収録し、利用条件・版・CRS・加工表示は[証拠README](../../data/evidence/location-batch2/tohoku/README.md)に記載した。規約と石巻配置図の再利用は旧取得日時を保持し、新取得と区別している。

地域共有の実測時間は447.217秒。選定保存から資料取得・比較・初回成果記録までのwall clockで、事前読解と後続検証・独立レビュー・PR作成を含まない。8施設へ重複加算せず、全国608施設へ外挿しない。

追加調査・検証の地域共有実測は945.583秒。初回447.217秒とは別の区間で、独立再レビューとPR更新は含めない。

## 検証と独立レビュー

- 意味検査6件と対象2施設の差分テストをRED→GREEN。Python全国全93件、Go `go test -count=1 ./...` 全件成功。Go終了コードを直接確認し、tailの終了コードで代用していない。
- `verify.py --raw` で原本・Range hash、59ID/8結果/6保留、事実参照、比較段階、全台帳差分を検査。`derive.py` と `measure_shapes.py` 再実行は保存JSONとbyte一致。重心・丸め後の内包を検査。
- assemble→Go builddata→全国監査を実施。一覧20261021、review-list20261105、as-of2026-11-05。1313カード/1735施設/1825関係、施設ピン978→980。full/details/pinsと世代hash、既存ピン全件不変を確認。[検証記録](../../data/evidence/location-batch2/tohoku/validation.json)。生成入力は親の保存原本をhash一致で再利用し、新取得ではない。
- 実full.jsonの2施設についてCardDetailを静的描画し名称・Maps座標queryを検査（Vitest成功）。外部Google Mapsの遷移・地図画面のブラウザー操作は未実施。UIコードは変更していない。
- Geminiは枠上限で失敗し、承認はない。[原文と履歴](../../data/national/location-batch2/tohoku/review.json)を保持。利用者が後からClaude Opus代替を許可した。初回Opusの重大指摘と今回の対応は[別記録](../../data/national/location-batch2/tohoku/opus-review.json)。新規独立再レビュー前であり承認済みとしない。
- 共通変更はmanifestの東北2行/bindingと `test_assemble.py` の履歴manifest切出し。844位置等の旧期待値/digestは変更せず、4歴史テストでbatch2を除く。東北差分は `test_location_batch2_tohoku.py` で実manifestを検査。共有進捗文書は編集しない。

## 修正した記録・コードの不一致

初稿の未実施3施設をbuilding-comparisonとした段階/共通停止文、男鹿の予定敷地図と取得写真の違い、factsの5資料欠落、READMEの取得記録がないWeb本文確認、Gemini失敗見出し省略を修正した。verifyが段階と参照の矛盾を見逃していたため回帰検査を追加した。新採用に対する履歴844件テストは履歴manifestへ限定し、現manifestとの目的を分離した。Issue24の石巻旧住所は履歴snapshotとして保持する。アプリの説明と実装について新たな不一致は確認していない。
