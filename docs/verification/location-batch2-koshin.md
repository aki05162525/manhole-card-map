# Issue37 甲信・位置調査第2弾

2026-11-05評価。対象はIssue24 originalRefとbatch1 baselineを照合した甲信27ID。開始時の地域未位置27・全国台帳未位置608を固定し、既採用による除外は0。選定8件はfirstPinと誤誘導リスクを優先した。残る19件は順位による打切りで追加調査に未着手であり、資料探索を尽くした除外ではない。[selection.json](../../data/national/location-batch2/koshin/selection.json) に全母集団と当初計画を保持した。初回保存は台帳キー誤記で失敗し、初回検索直後に修正した履歴も保持する。

batch1 integration/followups、Issue20/25/26/27の保留条件を確認した。今回8IDとの重複はない。最初のPRでは採用0としたが、Opusが既取得資料の見落としと比較未実施を指摘したため再調査した。資料がないことと未読・未比較を区別し直した。

## 再調査：選定8・提案4・保留4

4IDは独立再レビュー用にmanifestへ仮統合している。最終承認は未完であり、提案と判断を分離した。仮統合後は地域未位置23・全国台帳未位置604。608は開始集合であって採用後の件数ではない。

| 施設 | 実施した比較と判断 |
| --- | --- |
| 中央市役所宿日直室 | 既存方位付き航空写真のL字建物・駐車場・周囲別棟をGSI z16/57984/25824 BldA35へ照合。重心は外なので西翼内の代表点を計算し提案。旧P05の同定や入口測量は要求しない。 |
| fumottoまちの案内所 | 全体マップに臨時駐車場トレーラーが特定されず保留。FARM BASEを代用しない。2026-12-28の閉所予告を11月5日時点の恒久終了にしない。 |
| 松本市観光情報センター | 2点を外形へ実計算。観光CSV点はBldA340内、LinkData点は全外形外。点のCRS/作成方法が不明で独立した棟同定にはならず保留。 |
| クリーンレイク諏訪・受付 | 取得済suwa-plan.pdf物理p4（北/50m/令和5年3月末）とp8を比較。管理本館・電気棟の2翼＋連絡部、A/B系・道路の周囲対応からGSI z16/57906/25727 BldA23を同定し提案。 |
| 中央市役所上下水道課 | 航空写真と外形の比較は実施済み。ただし写真の棟名表示から南館を特定できず保留。「未比較」とはしない。 |
| クリーンレイク諏訪・ロビー | 受付と同じ連続した建物外形の代表点を提案。室内差は保留条件にせず、別IDを保持。 |
| アクアパル千曲管理本館 | 取得済配置図を135度時計回りに合わせ、角丸外形、河川・池・公園を比較。SW BldA10の面積1841.4939㎡を原典から再現、隣接タイルも照合し提案。橋名は「アクア小橋」。 |
| ゆきむら夢工房 | Git収録CSV NO65の点と外形の内包を実計算。ただし隣接する旧直売所との独立同定が不足し保留。236㎡は旧直売所の面積で転用しない。 |

候補ID・数値・停止再開条件は [outcomes.json](../../data/national/location-batch2/koshin/outcomes.json)、数値提案は [proposals.json](../../data/national/location-batch2/koshin/proposals.json)。4IDの [locations.json](../../data/national/location-batch2/koshin/locations.json) と [binding](../../data/national/location-batch2/koshin/location-lifecycle.json) を明示選択し、元行・旧値・hashを [prior-values.json](../../data/national/location-batch2/koshin/prior-values.json) に固定した。建物代表点であり入口や室内窓口の測量ではない。

## 証拠と検証

[外形比較](../../data/evidence/location-batch2/koshin/building-comparison.json)、[松本計算](../../data/evidence/location-batch2/koshin/matsumoto-comparison.json)、[証拠README](../../data/evidence/location-batch2/koshin/README.md) に資料版、CRS、軸順、加工、精度、利用条件、出典とhashを記録した。上田CSVは市カタログのCC BY4.0によりGit収録済みであり、facts/retrievalsの「workのみ/許諾未確認」を訂正した。別の利用規約PDFは未取得。一般HTML/PDF/画像は新たにGitへ複製せずworkに保持する。

- 4ID差分テストは未統合時のRED→仮統合後GREENを確認。全台帳の差分は当該4IDのcoordinate/evidence/locationReviewのみ。全関係・既存ピンは不変、他23IDは非採用。
- 全Pythonテスト93件成功。Go非cacheテストとフックを省略しない。
- 派生計算再現、CSV seed内包、重心/内代表点/7桁丸め後内包、千曲境界、参照JSON、原本/Range hash33件を検証。
- 保存一覧20261021・review-list20261105・as-of2026-11-05で採用前後をGo builddata生成し全国監査を実行。カード1313・場所1735・関係1825は不変。施設ピン978→982、蓋1309は不変。full/details/pins整合・世代hash・4IDの詳細→Mapsリンクを既存関数で検査。[生成検証](../../data/evidence/location-batch2/koshin/generation-check.json) を参照。
- サーバー・ブラウザーは起動せず、UIコードも変更していない。Mapsの外部画面、現地、現況との完全一致、各施設の現在在庫は未確認。

共有変更はmanifestの自地域選択と `test_assemble.py` の歴史テスト3件のmanifest分離のみ。844件や履歴digestの期待値を変更せず、全batch2を除くmanifestで履歴契約を維持する。地域差分は `test_location_batch2_koshin.py` で検査する。共有進捗文書は変更していない。

地域共通の実測時間は [timing.json](../../data/national/location-batch2/koshin/timing.json)。初回303.142秒と今回再調査を分け、待ちを含む壁時計時間を8件へ重複計上しない。

## 独立レビューと訂正

[review.json](../../data/national/location-batch2/koshin/review.json) はGemini枠上限による失敗の履歴として保持した。利用者が代替のClaude Opusを許可したため、その初回指摘と全対応を [review-response.json](../../data/national/location-batch2/koshin/review-response.json) に別記した。修正後の新規Opus再レビューが残るためDraftを維持する。マージとCI監視は親担当。

発見した記録間の不一致は、諏訪全体配置図の「追加取得待ち」、実施前の外形比較を根拠不足とした中央市/千曲/松本の記述、上田CSVの収録・許諾状態、橋名、当初計画と実際のnewMethod、19件の除外説明。今回訂正した。既存コードとの別の不一致は発見していない。
