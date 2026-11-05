# 東北の位置調査・第2弾（Issue #34）

基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83` の現manifestをassembleし、Issue24 snapshotの `originalRef` が東北原調査を指す59IDをbatch1 baselineと照合した。59IDすべて未位置で既採用の除外は0。全国台帳の未位置608は開始時の実測集合であり、生成全体の未位置施設数ではない。

[selection.json](../../data/national/location-batch2/tohoku/selection.json) を新規調査前に保存した。初ピン候補と移転・別棟の懸念を優先して8施設を選定し、残る50施設は今回後順、秋田市守衛室1施設はIssue20の既存保留を維持した。[全59IDの分類と除外理由](../../data/national/location-batch2/tohoku/coverage.json)、[分類集計](../../data/national/location-batch2/tohoku/classification.json)を参照。配布分類53 active・2 suspended・4 needs-reviewは保存snapshotの分類で、全件を新たにWeb確認した意味ではない。

結果は **8施設調査、代表点算出3、採用2（山田情報棟・花巻本館）、保留6**。Gemini Flash最終レビューで2点とも承認、重大指摘0。花巻の反証・推論限界・形状差は承認後も保持する。main `d8800718` の北海道・近畿西・甲信の採用/binding/地域テストを保持して統合した。最新mainの未位置601に東北2点を追加すると599、地域は59→57。開始時全国608とは別の実測値。東北差分は2施設のcoordinate/evidence/locationReviewだけで、全関係と全既存ピンは不変。

| 施設 | 追加調査結果と停止・再開条件 |
| --- | --- |
| 石巻かわまち交流センター | 414の498.47㎡は資料463.04㎡に近く、417の294.34㎡より支持的。しかし2施設区画と3外形の所属・堤防側区切りを未確定。高解像度図等で再開。 |
| 道の駅おが | 実際に取得した資料は運営者写真。228/279と周辺219/161を比較したが背後棟と方位を同定できず保留。3111の用途を推測しない。 |
| チェリーランド | 写真の入口表示を確認。Vectorとの比較は未実施で資料確認段階。案内所を同定できる配置資料等で再開。 |
| 花巻新館 | 405/402/324の形状を比較したが細長い図だけで一意対応できず保留。本館との相対配置等で再開。 |
| 河北 紅花資料館物産館 | 図の物産館と県道285号側の配置を確認。Vector照合は未実施と明記。地理参照外形との対応で再開。 |
| あぶくま洞管理事務所 | 洞内図・貸出案内には管理棟外周の情報がなく保留。管理棟を同定する園地図等で再開。 |
| 花巻本館警備員室 | L字の向き、回転補正後の横棒厚比（図.33/396 .343）、南側398の開始位置（幅の.658〜.659）を照合。新館1階「警備」の反証も記録。396の共通横棒内の重心を採用。敷地図や入口測量を形式的必須にしない。 |
| 道の駅やまだ情報棟 | PDF2頁の北矢印、3方向の道路、南西販売棟126/北東情報棟127、127東側切欠きを照合。町の現配布案内も情報棟を明記。127の重心を採用。運営者の地番差は未解決だが旧地図点は両棟外の同敷地付近。道路/配置/現配布棟指定で選択し住所点に依存しない。 |

[比較の肯定根拠と限界](../../data/evidence/location-batch2/tohoku/building-comparisons.json)、[再計算可能な外形・面積](../../data/evidence/location-batch2/tohoku/shape-measurements.json)を保存した。

| 採用施設ID | 代表点 lat,lng | binding |
| --- | --- | --- |
| facility:north-db757b448c8db73422a5 | 39.3885493,141.1168429 | location-lifecycle.json の同ID |
| facility:north-e2dfc05c8b1db51fc65b | 39.478372,141.9535192 | location-lifecycle.json の同ID |

bindingと位置追補は `data/national/location-batch2/tohoku/`。元行の旧値とhashは `previous-places.json`、manifestは2行とbindingファイルhashを明示選択する。

詳細なID・出典・停止再開条件は [outcomes.json](../../data/national/location-batch2/tohoku/outcomes.json)、原本URL・日時・hashは [retrievals.json](../../data/evidence/location-batch2/tohoku/retrievals.json)、ページ単位の事実は [facts.json](../../data/evidence/location-batch2/tohoku/facts.json) にある。

石巻の旧住所競合はIssue26で訂正済みで、今回未解決なのは建物外形との対応。旧P05点や市markerを採用値へ流用しない。花巻2施設は本館と新館を区別し、同住所を同棟の証明にしない。batch1の東2候補保留と同様に、ヒント点を含む外形を選べるだけでは同定済みにしない。Issue20/25/26/27およびbatch1 integration/followupsの保留条件を変更していない。

原本HTML/PDF/写真は `data/work/location-batch2/tohoku/` のみに保持。Gitには事実抽出と取得hashを収録した。明示条件を確認した試験Vector4タイルのみ証拠へ収録し、利用条件・版・CRS・加工表示は[証拠README](../../data/evidence/location-batch2/tohoku/README.md)に記載した。規約と石巻配置図の再利用は旧取得日時を保持し、新取得と区別している。

地域共有の実測時間は447.217秒。選定保存から資料取得・比較・初回成果記録までのwall clockで、事前読解と後続検証・独立レビュー・PR作成を含まない。8施設へ重複加算せず、全国608施設へ外挿しない。

追加調査・検証の地域共有実測は945.583秒。初回447.217秒とは別の区間で、独立再レビューとPR更新は含めない。

## 花巻の反証と計測の訂正

新館1階にも「警備」室がある。市の案内ページは本館・新館の双方に「本庁舎」を冠し、その語だけでは棟を限定できない。配布案内の「新館2階」と「本庁舎1階守衛室」の書き分け、本館図だけにある「守衛室・宿直室」の表記から本館と判断する。ただし「配布の守衛室は本館」と市が直接断定した資料は未確認で、自治体への照会も行っていない。

上辺に沿って回転すると396の全幅/高さは約1.445、横棒厚.343。398の開始.658〜.659は図の約.676に近いが、東端1.039は図の約.965を超える。脚幅は下部.397/くびれ.278で、各階図の約.33と異なる。図の1階だけ全幅/高さ約1.65の差も残る。「地階外周」「階差で脚幅を説明」の記述は撤回した。代表点(.415,.269)は共通横棒内で差に依存しない。数値は[回転計測](../../data/evidence/location-batch2/tohoku/alignment-measurements.json)で再現可能。注記と旧P05も396内だが市役所全体点の可能性があり、棟判別に使わない。

## 検証と独立レビュー

- 意味検査6件と対象2施設の差分テストをRED→GREEN。統合後Python全国全105件（研究回帰6件とverifyをCI対象に追加）、Go `go test -count=1 ./...` 全件成功。Go終了コードを直接確認し、tailの終了コードで代用していない。
- `verify.py --raw` で原本・Range hash、59ID/8結果/6保留、事実参照、比較段階、全台帳差分を検査。`derive.py` と `measure_shapes.py` 再実行は保存JSONとbyte一致。重心・丸め後の内包を検査。
- assemble→Go builddata→全国監査を実施。一覧20261021、review-list20261105、as-of2026-11-05。1313カード/1735施設/1825関係、北海道・近畿西・甲信統合後の施設ピン985→987。full/details/pinsと世代hash、既存ピン全件不変を確認。[検証記録](../../data/evidence/location-batch2/tohoku/validation.json)。生成入力は親の保存原本をhash一致で再利用し、新取得ではない。
- 実full.jsonの2施設についてCardDetailを静的描画し名称・Maps座標queryを検査（Vitest成功）。外部Google Mapsの遷移・地図画面のブラウザー操作は未実施。UIコードは変更していない。
- Geminiは枠上限で失敗し、承認はない。[原文と履歴](../../data/national/location-batch2/tohoku/review.json)を保持。利用者が後からClaude Opus代替を許可した。初回Opusの重大指摘と今回の対応は[別記録](../../data/national/location-batch2/tohoku/opus-review.json)。Opus再レビューは山田を承認し花巻の記録修正を要求。反証・数値・CI接続を修正後、利用者が指定したGemini Flash最終確認で2点承認。失敗と条件付き判断は履歴として保持。
- 共通変更はmanifestの東北2行/binding。`test_assemble.py` の履歴manifest切出しは北海道と同じ意味だったためmain版へ統一し、mainとの差分はない。844位置等の旧期待値/digestは変更せず、4歴史テストでbatch2を除く。東北差分は `test_location_batch2_tohoku.py` で実manifestを検査。共有進捗文書は編集しない。

## 修正した記録・コードの不一致

初稿の未実施3施設をbuilding-comparisonとした段階/共通停止文、男鹿の予定敷地図と取得写真の違い、factsの5資料欠落、READMEの取得記録がないWeb本文確認、Gemini失敗見出し省略を修正した。verifyが段階と参照の矛盾を見逃していたため回帰検査を追加した。新採用に対する履歴844件テストは履歴manifestへ限定し、現manifestとの目的を分離した。Issue24の石巻旧住所は履歴snapshotとして保持する。アプリの説明と実装について新たな不一致は確認していない。

再レビューで判明した不一致も修正した: 花巻新館「警備」の欠落、回転なしの比率/脚幅と地階説明、山田番地差の限界記録、花巻newMethodの配置資料という誤記、山田README参照欠落。研究回帰テストはCI対象外だったため全国discoveryへ接続し、verifyの全batch2差分判定を東北単独へ修正した。共有 `docs/national-assembly.md:56` はIssue26/30だけの除外記載で、コードはbatch2も除外する。共有文書は親の統合対象のため編集せず、この不一致を引き継ぐ。未承認manifest仮統合は利用者が許可したDraft検証だった。最終承認後に採用状態を同期し、この差は解消した。

当時の最終修正確認の新規Claude Opus依頼は `Claude API rate limit reached. Try again later.` で失敗した。その後、親が利用者許可のGemini Flashへ新規依頼し、head e2b73a59の2点を最終承認した。[最終レビュー記録](../../data/national/location-batch2/tohoku/gemini-final-review.json)。提案時点のinvestigatorDecisionを遡及変更せず、採用確定はこの記録とoutcomesで追跡する。
