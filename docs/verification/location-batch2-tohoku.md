# 東北の位置調査・第2弾（Issue #34）

基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83` の現manifestをassembleし、Issue24 snapshotの `originalRef` が東北原調査を指す59IDをbatch1 baselineと照合した。59IDすべて未位置で既採用の除外は0。全国台帳の未位置608は開始時の実測集合であり、生成全体の未位置施設数ではない。

[selection.json](../../data/national/location-batch2/tohoku/selection.json) を新規調査前に保存した。初ピン候補と移転・別棟の懸念を優先して8施設を選定し、残る50施設は今回後順、秋田市守衛室1施設はIssue20の既存保留を維持した。[全59IDの分類と除外理由](../../data/national/location-batch2/tohoku/coverage.json)、[分類集計](../../data/national/location-batch2/tohoku/classification.json)を参照。配布分類53 active・2 suspended・4 needs-reviewは保存snapshotの分類で、全件を新たにWeb確認した意味ではない。

結果は **8施設調査、外形の数値比較候補2、採用0、保留8**。候補2は施設と外形の同定未承認であり、位置追補・binding・manifest選択を作成していない。台帳、関係、既存ピン、共有テスト・共有進捗文書に変更はない。地域未位置59、全国台帳未位置608は前後不変。

| 施設 | 新資料・別手法と結果 | 再開に必要な根拠 |
| --- | --- | --- |
| 石巻市かわまち交流センター | Issue26保存配置図と最新試験Vectorを比較。BldA index414を仮説として計算し丸め後内包まで確認。隣接417・堤防接続部との区切りは小縮尺図から独立確定できない。 | 414/417の対応と周辺道路・堤防を確認できる高解像度平面図等。 |
| 道の駅おが オガーレ | 運営者conceptページの建物写真を実見。旧q付近の1タイルで主棟・背後の塔を一意対応できず、外形選択を停止。 | 主棟と道路・男鹿駅の方位を接続する公的配置図。必要に応じ隣接タイル。 |
| チェリーランド総合観光案内所 | 新たに掲載写真を取得し入口表示と外観を確認。住所差と数値外形の接続は未解決。 | 案内所を明記した敷地平面図または対象棟・CRSが明確な施設点。 |
| 花巻市役所 下水道課 | 新館PDFで2階の下水道課を確認。細長い外形だけでは近傍矩形を選べない。 | 本館・新館を同時に示す敷地配置図。 |
| 河北町 紅花資料館 物産館 | 町パンフレットで物産館・案内所と長屋門・紅の館を区別。県道285号側の建物と分かった。地理参照外形との照合は未完。 | 道路・敷地配置を含む現外形との同定。 |
| あぶくま洞管理事務所 | 見どころPDFと施設貸出案内へ探索を変更。洞内コースや連絡先はあるが管理棟外周を同定する図は得られず。 | 管理棟を明記した園地配置図・公開GIS等。 |
| 花巻市役所 本庁舎警備員室 | 本館PDFのL字形・守衛室とBldA index396を比較。重心・丸め後内包は成功したが方位・敷地配置の接続は未完。 | 本館・新館と周辺道路を結ぶ配置図等。 |
| 道の駅やまだ おいすた | 2023移転開業の町/国交省資料を取得。第5地割66番地1、情報/トイレ棟と販売棟を北矢印付き図で区別。現Vector比較は未実施。 | 情報棟の現外形との比較、現配布の継続確認。 |

詳細なID・出典・停止再開条件は [outcomes.json](../../data/national/location-batch2/tohoku/outcomes.json)、原本URL・日時・hashは [retrievals.json](../../data/evidence/location-batch2/tohoku/retrievals.json)、ページ単位の事実は [facts.json](../../data/evidence/location-batch2/tohoku/facts.json) にある。

石巻の旧住所競合はIssue26で訂正済みで、今回未解決なのは建物外形との対応。旧P05点や市markerを採用値へ流用しない。花巻2施設は本館と新館を区別し、同住所を同棟の証明にしない。batch1の東2候補保留と同様に、ヒント点を含む外形を選べるだけでは同定済みにしない。Issue20/25/26/27およびbatch1 integration/followupsの保留条件を変更していない。

原本HTML/PDF/写真は `data/work/location-batch2/tohoku/` のみに保持。Gitには事実抽出と取得hashを収録した。明示条件を確認した試験Vector3タイルのみ証拠へ収録し、利用条件・版・CRS・加工表示は[証拠README](../../data/evidence/location-batch2/tohoku/README.md)に記載した。規約と石巻配置図の再利用は旧取得日時を保持し、新取得と区別している。

地域共有の実測時間は447.217秒。選定保存から資料取得・比較・初回成果記録までのwall clockで、事前読解と後続検証・独立レビュー・PR作成を含まない。8施設へ重複加算せず、全国608施設へ外挿しない。

## 検証

- commitフックを省略せず実行し、`go test -count=1 ./...` 成功（builddata内のPython統合テストを含む）。frontendフックは対象変更なし。
- 現manifest assemble成功。59IDの未位置、batch1 baselineとの一致、既採用0を確認。
- `verify.py --raw` 成功。全59IDのoriginal/review JSON pointer、8選定/8結果、成功原本とRange原本hash、出典IDと事実hash、未採用を検査。
- `derive.py` の再実行で保存結果と一致。2外形のvalidity、重心内包、丸め後内包を検査。これは建物同定の承認ではない。
- 採用・アプリコード変更なし。Go builddata/full/details/pins再生成・Maps操作・UIテストは今回未実施。現台帳の前後同一性はassemble出力のbytes比較で確認済み。
- Gemini 4 Argon（antigravity/shared/review）を依頼したが、利用枠上限で失敗。指摘・承認は得られておらず、独立レビュー要件は未達。代替モデルは使わず、採用0のDraft PRとして引き継ぐ。[レビュー試行記録](../../data/national/location-batch2/tohoku/review.json)。

この調査で新たなdocs/code不一致は発見していない。Issue24の石巻旧住所競合は履歴snapshotとして保持し、現在の未解決条件と区別した。
