# 神奈川県・初回調査（Issue #62）

基準は `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は2026-11-05。
**14施設のうち数値外形との今回照合は1施設、候補1、採用0。残り13施設の数値照合は未着手。**
全県完了ではなく、独立レビューに渡す初回Draft。共有manifest、配布関係、配信データは変更していない。

## 対象と引継ぎ

[scope.json](../../data/national/kanto-prefecture/kanagawa/scope.json)に現assembleの施設・関係の旧値、入力hash、全14ID、索引履歴を保存した。
全国未位置588施設から県名・全市町村名とカード所属を照合し、Issue本文の14件を維持した。
名称検索に混入した栃木県矢板市川崎反町は除外。三浦海岸駅前は観光協会原本の「神奈川県三浦市南下浦町上宮田1497」、
綾瀬は市施設詳細の所在地を確認した。未知の移転先や地名のない施設まで網羅した保証ではない。

索引の全履歴を解決した[抽出記録](../../data/evidence/kanto-prefecture/kanagawa/history-extract.json)を保持する。
Issue16/20/25〜27・batch1/2の広域レビューは県内の自動承認に読み替えない。
Issue57人手キューの回答済み34群に対象IDはない。利用者回答を新たな独立確認として扱っていない。

施設別の実施段階・次作業は[outcomes.json](../../data/national/kanto-prefecture/kanagawa/outcomes.json)を参照。
13件の未着手を「資料不足」「外形未収録」へ置き換えない。うち三浦市役所は現配布棟の資料間不一致、
綾瀬は11月22日のイベント配布予定を先に確認する。綾瀬の現関係は既に `upcoming` であり重複修正しない。
葉山の100周年2種の配布終了は対象ヨットデザインの終了ではない。

## 第1別館の候補

対象 `facility:kanto-south-d3e8ff1b9fe8cdfa07d3` の候補は **35.5717352, 139.3726981**。
市のカード案内は第1別館2階下水道経営課を指定する。
保存周辺案内図1頁を目視し、北矢印が左上を向くことを確認した。
本館、第2別館、職員会館、連絡部分、市役所さくら通り、道路反対側の郵便局との配置で
GSIの `z16/58140/25831 BldA[39]` と西隣タイルの断片 `BldA[761]` を第1別館候補に対応させた。

9タイルの全外形・道路を[全域SVG](../../data/evidence/kanto-prefecture/kanagawa/sagamihara-all.svg)に描画した。
[詳細SVG](../../data/evidence/kanto-prefecture/kanagawa/sagamihara-detail.svg)は部分表示。番号ラベルのみ小外形を省略し、図形は保持する。
タイル境界のbuffer重複をunionすると面積は概算1482m²。取得範囲外端には触れない。
数値計算と丸め後内包は[numeric](../../data/evidence/kanto-prefecture/kanagawa/sagamihara-numeric.json)、
原本の頁・方位・照合根拠と未読範囲は[inspection](../../data/evidence/kanto-prefecture/kanagawa/inspection.json)に分けた。

基本方針PDFは再取得hashがbatch2と一致。13頁中4頁のみ画像確認し、全頁テキストから関連語を検索した。
全頁目視済みとはしない。中央タイルのhashもbatch2と一致した。
新しい自治体原本はignored `data/work/kanto-kanagawa/` のみに保存しGitには含めない。

製品READMEの2026-07-01版、PDL1.0、試験公開という条件を継承した。
一般地理院仕様と製品固有の測地系適用は別判断で、**CRS適用・棟同定の独立承認は未了**。
小数7桁は測量精度ではない。候補を取得したことは稼働・在庫の確認ではない。

[locations](../../data/national/kanto-prefecture/kanagawa/locations-proposed.json)、
[lifecycle](../../data/national/kanto-prefecture/kanagawa/lifecycle-proposed.json)、
[明示選択案](../../data/national/kanto-prefecture/kanagawa/selection-proposed.json)は現schemaで仮統合を検査するための案。
`approvedForIntegration=false`。schema上の `approved` 配列を人の承認済みという意味で読まない。
親が独立レビュー後に順番に統合する。

## 人手確認・計測の不足

[2問の提案](../../data/national/kanto-prefecture/kanagawa/human-questions-proposed.json)にID・施設名・公式URLを付けた。
葉山は休日窓口が入園受付棟か、三浦市役所は旧第2分館か移転先かを確認する。自治体へ連絡していない。
三浦の2024年公表資料は2026年4月移転の予定であり、予定だけで移転完了・旧窓口終了を決めない。

[時間記録](../../data/evidence/kanto-prefecture/kanagawa/timing.json)の332.741秒は第1別館調査の開始から仮点保存までのwall clock。
HTTP待ち中の県全体棚卸しを含むため、施設専有作業時間ではない。残る13施設の個別読解時間は未計測。
後付け配賦をしておらず、施設別純作業時間の要件は未達。

## 検証と既知の差

対象テストは候補ファイル未作成でRED（2エラー）→作成後GREEN。
仮統合は1施設の座標・Evidence・locationReviewだけを変更し、他施設・配布関係は不変。
候補hash改変の拒否、外形外の点の不合格も検査する。テスト成功を原本読解や独立承認の代わりにしない。
全国Python・非キャッシュGoは通常コミットフックの証跡を使用し、同一入力で手動全suiteを重ねない。
入力hash・終了コード・ログは[validation](../../data/evidence/kanto-prefecture/kanagawa/validation.json)を参照。
UI変更がないためUI・ブラウザー検証は未実施。

既存の記録差として、batch2南関東のVector記録はJGD2011を確定的に記す一方、
現共通処理はXYZ計算のみで製品へのCRS適用を承認しない。本稿も後者に従い未承認とした（Issue57既知差を継承）。
今回新たなコードと文書の不一致は見つけていない。Range不一致時metadata不足の既知P3を修正していない。
今回のRange取得は成功応答であり、その不具合が解消した証跡にはならない。

## 通常フックの確定証跡

対象commit: `35077e7ad87728f22a29339c8ee615d4c373f15c`。`mise exec -- git commit` 終了コード0。
`validation.json` の入力hash全件を再照合して一致。以後の変更は本節の追記のみ。
`TestNationalAssemblyFailureGuards` が全国Python unittestを内部実行するため、手動で全suiteを再実行していない。
Go成功時は内側Pythonの標準出力が表示されない。下記はフック出力をANSI除去したログで、個別Pythonテスト結果を捏造していない。
原ログSHA256: `4190b43dda68f3f8abbfc404daa3743aa86f20edbf4832075372b8336333587e`。

```text
╭──────────────────────────────────────╮
│ lefthook  v2.2.2   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  frontend ❯ 

┃  go-test ❯ 
+ go test -count=1 ./...
?   	github.com/aki05162525/manhole-card-map/cmd/addresses	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/builddata	86.863s
?   	github.com/aki05162525/manhole-card-map/cmd/fetchimages	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/fetchlist	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/inspect	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/listdiff	0.003s
ok  	github.com/aki05162525/manhole-card-map/cmd/municheck	0.005s
?   	github.com/aki05162525/manhole-card-map/cmd/ocrcheck	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue5/review-west-south	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue5/review-yokohama-priority	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/kyushu-okinawa	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-chugoku	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-hokkaido	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-kinki-west	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-koshin	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-kyushu-okinawa	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-south-kanto	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-tohoku	[no test files]
ok  	github.com/aki05162525/manhole-card-map/internal/cardimg	0.003s
ok  	github.com/aki05162525/manhole-card-map/internal/gkp	0.003s
ok  	github.com/aki05162525/manhole-card-map/internal/municipality	0.003s

  ────────────────────────────────────
summary: (done in 87.70 seconds)
✓ frontend (0.03 seconds)
✓ go-test (87.70 seconds)
```
