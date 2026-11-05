# Issue37 甲信・位置調査第2弾

2026-11-05評価。現manifestをassembleし、Issue24の `originalRef` が甲信の27IDすべてをbatch1 baselineと照合した。27IDはすべて現在も未位置で、既採用による除外は0。全国台帳未位置608はこの開始manifestの実測値である。今回は新規採用0のため終了時も同数。生成全体の未位置集合や他地域の採用後推計ではない。

[selection.json](../../data/national/location-batch2/koshin/selection.json) に全27施設の既存所見・分類・19件の今回除外理由と、順位上位8件の新手法を保存した。8件はいずれも保存済みIssue24のfirstPin候補で、旧庁舎・別棟・座標競合リスクを優先した。firstPinは保存一覧による分類で、今回の在庫再確認ではない。初回保存スクリプトが台帳の `places` キーを誤記して失敗し、初回検索直後に修正保存した。選定は検索前に決め、検索結果で入れ替えていない。

batch1 integration/followupsとIssue20/25/26/27の保留条件を読んだ。対象8IDとの重複はない。Issue7の取得原本・reviewを起点にし、同じ配布案内の再取得を追加成果とは数えない。今回の結果は限定調査で、資料探索を尽くしたという主張ではない。

## 結果：選定8・採用0・保留8

個別ID、事実への参照、停止・再開条件は [outcomes.json](../../data/national/location-batch2/koshin/outcomes.json)。数値診断と最終判断を分け、[proposals.json](../../data/national/location-batch2/koshin/proposals.json) はupdates/bindingsとも空。manifest、台帳、関係、既存ピン、アプリは変更していない。

| 施設 | 新たに確認した資料と到達点 | 残る条件 |
| --- | --- | --- |
| 中央市役所宿日直室 | 公共施設計画の改修履歴 | 本館・南館合算資料では西側宿日直棟と旧田富点を結べない |
| fumottoまちの案内所 | 現全体マップと市の閉所予定告知 | 臨時駐車場のトレーラーが図に特定されない。FARM BASE案内所を流用しない |
| 松本市観光情報センター | 観光CSV・公共施設台帳の大手事務所点を取得 | 約22m差、CRS/作成方法不明。追加Shapeにもprjなし。公民館は別施設 |
| クリーンレイク諏訪・受付 | 令和4年度年報の管理本館平面図を画像判読 | 2翼と通路の形は読めるが、方位・全体配置と地理参照外形の接続は未完 |
| 中央市役所上下水道課 | 南館2019改修と本館2018建設の履歴 | 南館の棟別数値対応は未確認 |
| クリーンレイク諏訪・ロビー | 同年報で管理本館のホール・受付配置を確認 | 受付との室内差は保留理由ではない。外形比較が未完でIDも保持 |
| アクアパル千曲管理本館 | 市の被災復旧資料に管理本館・車庫・ポンプ棟・橋の配置 | 現行Vector取得・外形比較は今回未実施。配置資料不存在という以前の不足を一段進めた |
| ゆきむら夢工房 | 2026更新CSV、国交省公開の旧直売所活用資料、GSI Vector診断 | 同一敷地に別の旧直売所。CSV内包のみで外形を選ぶ依存が解消しない |

fumottoは市が2026-12-28の閉所を予告した。将来の移転先・配布継続を再確認するキューとして残し、11月5日時点で終了へ変更しない。中央市計画のURLは `r3-3` だが表紙は令和4年3月改訂。上田の236㎡は旧直売所の面積で、夢工房の面積に転用しない。松本の市入口CC BY4.0とLinkData個別CC BY3.0、一般GIS背景の制限は区別した。

## 証拠と検証

[事実抽出](../../data/evidence/location-batch2/koshin/facts.json) と[取得記録](../../data/evidence/location-batch2/koshin/retrievals.json)に原本URL・UTC・hash・版・頁/行を保存した。一般HTML/PDF/写真はignored workのみ。許諾が明示された上田CSVとGSIの対象1タイルだけを原bytesでGitへ追加した。出典・加工・測地系・軸順・精度の留保は[証拠README](../../data/evidence/location-batch2/koshin/README.md)に記載。

- 現manifest assemble成功。27IDの母集団・baseline一致、8IDの選定/結果対応、参照JSON pointer、未採用、入力hashを専用検証で確認。
- ローカル取得原本/Rangeの22 hash検査成功。Gitだけの検証も別に実行する。
- 上田の診断重心は派生計算を再実行し、Polygon内包と7桁丸め後の内包を確認。これは現施設との対応の承認ではない。
- 研究記録のみでアプリ・台帳・manifestを変更していないため、独立した全Python/UIテスト、Go builddata/full/details/pins/Maps再生成は再実行しない。ただし既存commit hookはdata配下の変更に対して `go test -count=1 ./...` を要求するため、その検証は省略しない（Go経由のPython検証を含む）。サーバーは起動していない。

地域共通の壁時計時間は [timing.json](../../data/national/location-batch2/koshin/timing.json) の303.142秒。選定保存修正後から追加資料調査と結果記録までで、初期読込・初回検索、後続検証・Gemini・PRを除く。並列HTTPや待ちも含み、8施設へ重複計上せず、地域全件の工数へ外挿しない。

未確認は現地、原本の最新現況への完全対応、松本/上田CSVのCRS・作成方法、諏訪/千曲の外形比較、各施設の現在在庫。入口・室内位置の精度を追加条件にはしていない。

## 独立レビュー

Gemini 4 Argonへ本worktreeの証拠・保留・検証の独立レビューを依頼したが、Antigravityの利用枠上限で失敗した。独立レビューは未実施で、重大指摘0件とは扱わない。[review.json](../../data/national/location-batch2/koshin/review.json) に失敗と対応を記録した。代替モデルは使わず、独立レビュー未完のdraft PRとして提出する。利用枠回復後のレビューが残る。未承認診断点の採用は行わない。

今回、新たなドキュメントと実装の不一致は見つけていない。共有ドキュメント・共有テスト・manifestの変更はない。
