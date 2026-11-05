# Issue36 南関東・位置調査第2弾

基準コミットは `f66b7e994ef250fadee78f396d22fdfc40ba6a83`。Issue24のoriginalRefがsouth-kantoに属する56IDをbatch1 baselineと照合し、現manifestでassembleした未位置集合に全件含まれることを確認した。全地域608はこの開始時集合で、生成全体の未位置数ではない。南関東56件の分類は[selection.json](../../data/national/location-batch2/south-kanto/selection.json)に全件保存。分類・firstPinは2026-11-05評価の保存監査を継承し、今回の全関係のWeb再確認ではない。

選定は初ピンと移転・別棟の誤誘導防止を優先した8ID。資料を探索する前に選定ID、全56件の選定/除外理由、原記録/レビュー参照、入力hash、従来の数値検索から変更する手法を保存した。地域の無作為標本ではない。Issue20/25/26/27とbatch1 integration/followupsの既存保留は本地域と重ならない。Issue7の保留は保持し、新しい配置・建設資料と外形照合を試した。

## 結果

[成果](../../data/national/location-batch2/south-kanto/outcomes.json)は選定8、座標提案0、採用0、保留8。manifest、位置binding、施設・配布関係・住所・既存ピンの入力は変更していない。研究段階の棟識別を位置採用と扱わず、建物代表点の派生計算・丸め後内包検査には進めていない。入口や室内窓口の測量を保留条件にはしていない。

| 対象（ID末尾） | 新しく確認した資料と判断 | 残る条件 |
| --- | --- | --- |
| 袖ケ浦下水道課 `38d7a5c180ebcf42c381` | 処理場現況図PDF2ページで管理棟・処理槽・正門を区別。検索にある別配置図は直接取得404 | 管理棟の地理参照外形を取得し配置を対応。今回この処理場のVectorは未取得 |
| 白井守衛室 `5724e90e3e451f22eeef` | 2016年配置図と2018年開庁資料から本庁舎新築と東庁舎減築改修を区別 | 連絡部分を含むVector外形から現本庁舎の対象領域を確定 |
| 習志野下水道課 `b3c83a3795c4697c100b` | 2025年基本計画と新局舎予定地図を確認。予定地は現藤崎1丁目の「新館」と異なる | 現本館・新館・別館を名称付きで分ける配置図。計画移転を現移転と扱わない |
| 白井上下水道課 `caac2827c5303ba03047` | 東庁舎は減築改修棟。原調査の東庁舎2階所属を継承 | 東庁舎の領域を外形に対応。本庁舎と同住所でも同一地点にしない |
| 相模原下水道経営課 `d3e8ff1b9fe8cdfa07d3` | 2026年基本方針と原調査周辺案内図で第1別館を区別 | 概略図の回転・簡略化と接続部を含む外形の対応を確定。本館代表点は使わない |
| 袖ケ浦守衛室 `d4aaa6f664279d04fc85` | 名称記事と実施設計で南庁舎=旧3階棟解体後の2期棟と確認 | 竣工後の南庁舎と中庁舎・接続部の外形を対応 |
| 八千代お客様センター（工事） `integration-01` | 2023年配置図で上下水道局庁舎と新市庁舎・福祉センターを区別 | 計画と現況の差を解消し上下水道局棟を外形へ独立対応 |
| 袖ケ浦観光協会 `integration-05` | 南庁舎の整備履歴を確認。南庁舎1階所属は原調査の2026年案内図を継承 | 南庁舎外形を確定後、守衛室と別々のbindingを審査 |

各IDの停止・再開条件、資料版、旧調査参照、新手法は成果JSONにある。未選定48件は重要性なし・調査完了を意味しない。八千代宿直対応等の同住所施設を今回の8件へ追加していない。

## 証拠と再現

[取得記録](../../data/evidence/location-batch2/south-kanto/retrievals.json)にURL、取得日時、原本hash、HTTP結果を保存。[事実抽出](../../data/evidence/location-batch2/south-kanto/facts.json)は資料ごとの参照を持つ。一般HTML/PDF/画像の再配布条件は未確認なので原本とレンダリングは `data/work/location-batch2/south-kanto/` のみ。検索索引の本文を取得原本として扱わない。

[Vector記録](../../data/evidence/location-batch2/south-kanto/vector-inspection.json)には数値原典の10タイル、Range取得hash・ETag・Last-Modified、版、CRS/軸順、加工、未確認精度を記録した。出典は国土地理院最適化ベクトルタイル。README記載の版は2026-07-01で、個別地物の測量年月を保証しない。基本測量成果と位置付けない試験公開であり、ラスターと同じ利用条件だと推定しない。READMEからGSI規約への接続とPDL1.0、出典・加工表示を確認した。GSI規約は今回のPython取得がTLSで失敗したため、親workの保存原本をhash照合して再利用し、旧取得日を維持した。

GSIのREADMEを大文字で試した2件は旧west調査にもある失敗の反復だった。調査進展に数えず、eastの正しい小文字readme.mdへ訂正した。相模原のmap_r07.pdfも旧取得原本を読み取り再利用し、新取得と表示していない。

VectorはWeb Mercatorタイル格子、X右/Y下、extent4096でBldAを描画した。粗い探索窓は建物の数値根拠ではなく、含有だけでポリゴンを選んでいない。白井・袖ケ浦は境界をまたぐ周辺タイルも確認した。代表点、CRS変換、内包・丸め検査は未実施であり、精度確定済みとは主張しない。

地域共有の調査実測時間は339.862秒（約5.7分）。selection保存から新資料取得・比較・成果作成までのwall clockで、冒頭の既存資料読取、独立レビュー、後続検証を含めない。施設ごとに重複加算せず、56件や全国608件へ外挿しない。

```sh
mise exec -- python3 -B tools/national/assemble.py --out data/work/location-batch2/south-kanto/after-ledger.json --audit-out data/work/location-batch2/south-kanto/after-audit.json
mise exec -- python3 -B data/evidence/location-batch2/south-kanto/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with pillow==12.0.0 python data/evidence/location-batch2/south-kanto/inspect-vector.py
```

実施済み: 現manifestの統合、全56IDの母集団照合、8IDの成果・参照検査、取得成功原本/Range/10タイルのhash、10タイルのデコード再現、前後台帳の全フィールド・全関係一致。`verify.py` は `--raw` なしならGit管理資料だけで検査できる。

未実施: 新採用に伴うGo builddata/full/details/pins世代hash/Maps検査、全国監査の再生成、ブラウザー確認。採用・生成コード変更がなく台帳全フィールド一致のため、手動では研究範囲に絞って検証した。その後commit時の既存pre-commitフックがdata配下の変更を検出し、`go test -count=1 ./...`（cmd/builddata経由の全国Pythonテストを含む）を実行して成功した。フックの省略はない。既存の履歴digest/844期待値や共有テストへの変更もない。

## 独立レビュー

Gemini 4 Argonの独立レビューは承認可・重大指摘0件。母集団、原本と事実抽出、保留条件、原本再配布、旧取得日時、全台帳不変を照合し、verify.pyの両モードと10タイル再描画も独立実行した。[レビュー記録](../../data/national/location-batch2/south-kanto/review.json)に範囲と未確認事項を保存。修正要求はなく、座標の承認・自動採用はない。

## 文書とコード

今回新たに確認した文書とコードの不一致はない。既存文書中の過去件数はその時点の記録として扱った。

## Issue57での検証手順の訂正

当時の検証結果は上記のまま保持する。現在の `verify.py` は保存済みmanifestと当時の台帳hashで歴史基準を検査し、現manifestでは当該地域だけを除いた台帳との全フィールド・全関係差分を別に検査する。他地域の採用で当時の608件を更新しない。通常検査は全国Python試験にも含まれる。原本を検査するオプションには別途ignored workの原本が必要。今回の対象試験・未確認範囲は[Issue57の記録](issue57-workflow.md)を参照する。
