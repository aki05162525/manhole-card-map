# 群馬県の位置調査・初回Draft（#67 / 親#60）

基準は `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は2026-11-05。現assembleは1,586施設、位置未確定588。群馬カード（10-）の31施設から既採用18を除く13IDがIssue67と一致した。住所の県名検索も同集合。県名省略の館林・渋川2施設は既採用で対象外。全国全施設の移転先を公式資料で再監査した結果ではない。

13施設の公式配布本文を取得・読解した。数値外形との比較はテラス沼田2窓口と吉岡町1窓口の3IDまで。**候補2、棟対応未確定1、外形比較未着手10、採用0**。全13施設の位置調査完了ではない。共有manifest・配布関係・既存ピンは変更していない。候補の独立Codexレビューは親担当へ依頼する。

## レビュー入口

- [対象・旧値・入力hash](../../data/national/kanto-prefecture/gunma/inventory.json)。原調査、Issue16、batch1/2とレビュー履歴を保持。[参照先を解決した履歴](../../data/evidence/kanto-prefecture/gunma/inherited-records.json)は過去記録であり今回の成果ではない。Issue20/25〜27の該当ID履歴は現索引にない。
- [施設別結果と次作業](../../data/national/kanto-prefecture/gunma/outcomes.json)。配布先、在庫、現地稼働、建物同定、採用を分離。未着手10件を資料不足に分類していない。
- [原本取得](../../data/evidence/kanto-prefecture/gunma/retrievals.json)、[追加資料](../../data/evidence/kanto-prefecture/gunma/additional-retrievals.json)、[読解と外形比較](../../data/evidence/kanto-prefecture/gunma/inspection.json)。一般原本はこのworktreeのignored `data/work/kanto-prefecture/gunma/cache/`。別checkoutで同じbytesが取得できる保証はなく、親レビューは保存rawのhashを照合して使う。

## テラス沼田2窓口の候補

対象は `facility:kanto-north-5084d7132f37de70e96a`（5階観光交流課）と `facility:kanto-north-numata-water-4f`（4階上下水道経営課）。現配布本文は桜カードの水曜代替2窓口を列挙。現施設案内と各階画像で同棟を確認した。西倉内町の観光案内所は別ID・別建物として保持する。

候補は **緯度36.6439658、経度139.0427983**。GSIの隣接2タイル `16/58079/25589` BldA index531と `16/58080/25589` index9の断片をunionした建物外形重心。双方のbuffer重複を除き、有効なPolygon・丸め前後のstrict withinを確認した。9タイルの外端には接しない。公式建築面積4,304.4m²に対し外形面積は約4,451.9m²、約3.43%差。面積一致だけで選んだ点ではない。

2019年パンフ全2頁、現施設案内、4階・5階画像、案内地図を読解し、本体の南に道路を挟む駐車場と接続歩廊、北側道路・棟の位置関係を比較した。地図に北矢印はなく、現本文の「駐車場は南」を方位根拠とした。床図の「北EV」「南EV」は方位矢印として使っていない。南西側の隅切り、屋内アトリウムが上階吹抜けである点も記録した。GSIの個別更新日、測量精度、入口・室内の正確な位置は未確認。

[数値・断片・結合外形](../../data/evidence/kanto-prefecture/gunma/numata-geometry.json)、[全取得外形図](../../data/evidence/kanto-prefecture/gunma/numata-all.svg)、[タイル原本hash](../../data/evidence/kanto-prefecture/gunma/numata-tiles.json)を参照。採用前に、道路・南側駐車場との対応とunion計算を独立に再確認する。

[locations案](../../data/national/kanto-prefecture/gunma/locations-proposed.json)、[lifecycle案](../../data/national/kanto-prefecture/gunma/lifecycle-proposed.json)、[明示選択案](../../data/national/kanto-prefecture/gunma/manifest-proposal.json)は現assemble契約で試行できる。選択案の `approved` はschema上のキー名であり、承認済みという意味ではない。共有manifestへは未反映。親の承認前にコピーしない。

## 吉岡町の棟対応

平日の窓口は下野田560コミュニティセンター1階。本庁舎前の蓋レプリカとは別で、この情報は既存の配布関係evidenceにも記録されている。旧Issue7/16の本庁舎・同住所P05点競合を、そのまま現在の配布棟候補にしない。

2020年施設計画全7頁、庁舎マップ画像、現施設案内を読み、9タイルの全外形を描画・比較した。施設計画の「配置状況」は町全域の概略図、庁舎マップは本庁舎内部と別施設の文字見出し。東隣の外形2513をコミュニティセンターと断定する根拠は不足する。延床面積993m²を接地外形面積と混同しない。

[親への一問](../../data/national/kanto-prefecture/gunma/human-question-proposed.json)は「配布先コミュニティセンターは本庁舎の東隣の棟か」。34回答済みキューに群馬対象IDはなく、同じ質問の再依頼ではない。自治体へ連絡していない。回答後も外形と再照合し、回答だけで座標承認しない。

## 条件・原本・時間

[製品条件](../../data/evidence/kanto-prefecture/gunma/source-conditions.json)は固定製品readme、地理院タイル仕様、ベクトル定義を紐付ける。国内JGD2011 / Web Mercator格子の適用はこれらの組合せによる解釈であり、製品単独の測地系明記ではない。測地系変換なし。個別精度・更新日の保証なし。規約の直接取得はTLS/HTTP失敗を保持し、既保存規約のhash・原取得日時を検査して再利用した。失敗を成功に置換していない。PDL1.0に従い、国土地理院最適化ベクトルタイルをmanhole-card-mapが加工した旨を明記。一般HTML/PDF/写真はGit・ブラウザー配信へ含めない。

取得段階はID別の実時間をその場で保存した。[手動時間](../../data/evidence/kanto-prefecture/gunma/manual-timing.json)は共通作業・他施設読解が混在する区間で、施設別の専有秒数は未計測。後付け配賦しない。この点は要求を完全には満たしておらず、次の施設では専有区間の開始・終了を分離して記録する。

## 検証

[検証入力hashとログ](../../data/evidence/kanto-prefecture/gunma/validation.json)を参照。対象テストは候補未保存時に2 errors（RED）、保存後2テスト成功（GREEN）。候補2件のメモリ内manifest試行で、全施設ID・全配布関係が不変、変更フィールドがその2件のcoordinate/evidence/locationReviewのみとなることを検査した。現共有manifestは変更していない。

通常commit hookで非cache Goと内部の全国Python全suiteを実行し、そのログを引き継ぐ。手動で同一全suiteを重複実行しない。UI・ブラウザー試験は研究資料のみの変更のため未実施。テストは原本同定・採用承認を代替しない。親が本採用するときは、この初回テストの「共有manifest未反映」条件を統合後の差分条件へ更新する。

## 見つけた記録の不一致

- 旧吉岡町位置候補・再開条件は本庁舎の同定を中心に記述しているが、現配布関係evidenceと独立取得本文はコミュニティセンター1階を指定する。今回候補を流用せず、旧記録を保持した。
- `issue57-workflow.md` の「原本rawと取得metadataを保持」は成功時には成立するが、既知のRange不一致時はContent-Range/ETag等をrecordへ入れる前に例外となる（`research_common.fetch_cached`）。今回のRange取得は全て成功しており、この既知不具合を修正・再現試験したとは扱わない。

他の旧文書の不一致一覧はissue57の履歴を継承するが、今回すべてを再検証したとは主張しない。

## 通常フックの確定証跡

検証commit: `07edcffadb53f4129d4ad988eccce6c3b3bf0ff1`。開始 `2026-11-05T15:00:41.369828+00:00`、終了 `2026-11-05T15:02:13.013133+00:00`、終了コード `0`。コマンドは `mise exec -- git commit -m "research(gunma): record 13 targets and terrace Numata candidates"`。

入力hashはvalidation.jsonのinputSHA256に対応し、追記直前にcommit時の全45ファイルhashと現ファイルの一致を検査した。validation.jsonのfullSuite pendingはcommit前の記録であり、本追記で成功を確定する。以下のログはANSI色指定とcommitファイル一覧を除いた全文。元ログSHA256: `07f913896d3359512816313097b652a5bff7aca364d713f6f274b3fefa0ba0ab`。

```text
╭──────────────────────────────────────╮
│ lefthook  v2.2.2   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  frontend ❯ 

┃  go-test ❯ 
+ go test -count=1 ./...
?   	github.com/aki05162525/manhole-card-map/cmd/addresses	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/builddata	82.331s
?   	github.com/aki05162525/manhole-card-map/cmd/fetchimages	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/fetchlist	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/inspect	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/listdiff	0.004s
ok  	github.com/aki05162525/manhole-card-map/cmd/municheck	0.006s
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
ok  	github.com/aki05162525/manhole-card-map/internal/cardimg	0.005s
ok  	github.com/aki05162525/manhole-card-map/internal/gkp	0.004s
ok  	github.com/aki05162525/manhole-card-map/internal/municipality	0.004s

  ────────────────────────────────────
summary: (done in 83.21 seconds)
✓ frontend (0.03 seconds)
✓ go-test (83.21 seconds)
```

`cmd/builddata/fragments_test.go` の TestNationalAssemblyFailureGuards は `python3 -B -m unittest discover -s tools/national -v` を実行し、失敗時だけ出力する。従ってPythonの個別成功行はこのGoログに表示されない。Goパッケージ成功とその呼出し実装を合わせた証跡であり、別の手動Python全suiteログを捏造・重複実行していない。

この追記は文書のみで、データ・テスト入力は検証commitから同一。文書追記commitも通常フックを通す。独立Codexレビュー・CI状態はPR側で別途確認する。
