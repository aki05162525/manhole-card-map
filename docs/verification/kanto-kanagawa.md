# 神奈川県・全14施設調査（Issue #62）

基準mainは `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は **2026-11-05** のまま。HTTP取得時刻は各取得記録で別管理する。
全14施設について現配布案内・既往根拠・棟資料とGSI数値原典を調査し、外形との比較結果を保存した。
**未承認候補9件・照合後保留5件。採用は0、共有manifest未反映、全候補は独立レビュー未承認。** 調査完了を県の全位置採用完了とは扱わない。

[全件結果](../../data/national/kanto-prefecture/kanagawa/all-outcomes.json)は施設別の実施方法、候補、証拠hash、保留理由、次作業を含む。
[担当割当](../../data/national/kanto-prefecture/kanagawa/assignments.json)は北部4・西部4・半島5・県親1の重複なし14件。
[再集計](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/scope-crosscheck.json)で現assembleの神奈川カード所属・未位置施設14件と対象を照合した。県名推測だけで確定していない。

| 施設 | 全件調査後の扱い | 同定・残る理由 |
|---|---|---|
| 相模原第1別館 | 未承認候補 | 方位付き周辺図、連絡棟と隣接棟、buffer断片を比較。基本方針13頁全頁の追加読解、現下水道課第1別館2階を再確認 |
| かわさききたテラス | 未承認候補 | 現3F図・北口開業資料・市図を比較し北口突出部内。駅全体中心を代用しない |
| sagamix | 未承認候補 | SC2F店舗24、北矢印付きアクセス図でSC主体を駐車場・南北モールと分離 |
| 入江崎ワクワクアクア | 未承認候補 | 2018図と2026航空図を回転照合し管理棟443へ対応。旧北側14は棄却。CASBEE完了年月を新築/移転時点と読む推論を撤回 |
| 三浦海岸駅前観光案内所 | 照合後保留・人手質問 | 高架下区画の公式写真と9タイルを比較。京急構内図403、区画と外形の対応が未確定 |
| 四之宮ふれあいセンター | 未承認候補 | 県の棟名付き図と階段状外周・西道路・東処理区域。広場受付・トイレ・管理棟と分離 |
| 秦野浄水管理センター | 未承認候補 | 2025配置図の沈砂池管理棟。数値外形は機械棟と一体なので管理棟側内部点を選択 |
| 伊勢原アクアクリーンセンター | 未承認候補 | 現カードページ埋込棟図、窓口記述、北鉄道・東道路・西長棟を比較。質問は独立原本で解消 |
| オーエンス文化会館第2駐車場 | 屋外区画として保留 | 配置図の道路向かい南側駐車場。該当建物がない屋外イベント地点。本館プローブは明示棄却 |
| 葉山しおさい公園 | 照合後保留・人手質問 | 公式図・入口写真・博物館資料と8外形を比較。受付か別棟か現配布棟の明記がない |
| 三浦市役所第2分館 | 未承認候補 | 工期延長公式発表と現配布案内で旧移転予定の疑問を解消。結合外形の西側第2分館内部点 |
| 衣笠商店街サービスセンター | 照合後保留 | 2026商店街図と写真の小ブースを確認。交番と隣棟を比較したが小ブース外形対応が未確定 |
| 衣笠商店街事務所 | 回答後の外形照合保留 | 利用者は西友と同棟と回答。模式図には棟境界がなく7外形から西友棟の一意対応が未確定 |
| ヴェルニー公園管理事務所 | 未承認候補 | 指定管理者の同棟明記・2026.03パンフ2頁・公園図と海岸屈曲部の外形を照合 |

[全候補locations](../../data/national/kanto-prefecture/kanagawa/locations-all-proposed.json)、
[lifecycle/binding](../../data/national/kanto-prefecture/kanagawa/lifecycle-all-proposed.json)、
[明示選択案](../../data/national/kanto-prefecture/kanagawa/selection-all-proposed.json)を地域内に保存。
初回selection-proposedとは排他的に選択する。`approved` はassemble schemaのキーであり、今回承認された意味ではない。
旧値はscopeと地域別baseline、全台帳差分は対象テストで検査する。配布関係は変更せず、綾瀬upcoming等の既採用判断を維持する。

原本読解と数値照合は [north](../../data/evidence/kanto-prefecture/kanagawa/north/)、
[west](../../data/evidence/kanto-prefecture/kanagawa/west/README.md)、
[peninsula](../../data/evidence/kanto-prefecture/kanagawa/peninsula/README.md)、
[県内統合確認](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/integration-reading.json)を参照。
全頁画像精査の範囲は各観察記録に明記した。例えば四之宮の現配置図は52頁中36頁を視読し全頁テキスト検索、残り51頁の画像精査は未実施。
きたテラス開業資料8頁は全文抽出と6頁拡大視読、入江崎議会資料16頁は縮小一覧と対象頁拡大であり、全頁拡大読解済みとはしない。
各子の実時間記録を保持。第1別館の初回332.741秒に共通作業が混在した不足は、後付け配賦で修正していない。

[人手質問の現状](../../data/national/kanto-prefecture/kanagawa/human-questions-all.json)を集約。
三浦市役所の移転質問と伊勢原の棟質問は独立原本で解消して撤回。葉山・三浦海岸は調査後の具体質問を親へ通知、衣笠事務所は利用者から西友と同棟との回答を受領し、独立外形対応のみ保留。
回答済みの再質問、自治体への連絡はしていない。利用者の衣笠/伊勢原の回答は [2026-11-06報告](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/user-report-20261106.json) として独立取得・2026-11-05基準日から分離した。伊勢原の「北西端」と担当の「北東」の方位不一致は一次図を再照合し、敷地全体を示さない図から方角を断定しない。

GSI PMTilesは **2026-07-01版**、従来XYZの2023-10-01版とは区別する。
[CRS追加調査](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/crs-followup.json)でREADME・一般仕様・PMTiles metadataを照合。
XYZ逆投影の計算根拠は確認したが製品固有測地系の明記は見つからず、適用承認を独立レビューへ残した。
[利用条件](../../data/evidence/kanto-prefecture/kanagawa/rights.json)のPDL1.0・試験公開・出典/加工表示と原本provenanceを継承。
一般自治体原本はignored data/workのみ。小数7桁の内包は測量精度や棟同定の証明ではない。
[県親数値検証](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/parent-numeric-checks.json)は候補を原タイルから再decodeして保存外形との完全一致、座標と丸め後内包を再計算した。

新たな共通コード不具合・文書/code仕様不一致は発見していない。既往の「一般仕様だけで製品CRSを確定する」判断差は未解消として残す。
資料間の差（古い三浦移転予定、入江崎の年代、三浦海岸の年末休業日）と、初回文書の未着手状態はコード不一致と混同しない。

[今回の検証入力とRED→GREEN](../../data/evidence/kanto-prefecture/kanagawa/annex-followup/validation-all.json) に入力hash・コマンド・終了コード・ログを保存。対象5テストは全14件の実施証拠、候補9件の丸め内包、全台帳差分/関係不変、旧値・binding・hash改ざん拒否を検証した。全国suiteは下記の通常commit hookで一度実行する。

以下は初回提出時点の履歴。現在の実施件数・人手質問・全頁確認範囲は上記の全件結果を優先する。

---

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
