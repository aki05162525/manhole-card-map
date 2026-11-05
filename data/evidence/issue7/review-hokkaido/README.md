# 北海道 Issue 7 独立採否レビュー

対象68 ID。建物代表点として30件は採用可能。うち4件を `accepted`、P05の26件を規約説明・仕様書locatorの訂正が必要な `correction-required`、残る38件を `deferred` とした。26件は数値や建物同定の再調査を要求するものではない。元成果には変更を適用していない。

機械可読結果は `data/national/issue7/reviews/hokkaido.json`。`acceptedFacilityIds` はそのまま採用可能な4件、`adoptionFacilityIdsAfterExactCorrections` は訂正後の30件。全68件の個別理由・原典参照・残課題を含む。`exact-corrections.json` はJSON pointerまたは完全一致行によるold/newで、全30訂正のoldが現ファイルに一致することを確認した。

検証は `verify_review.py` と `build_review.py`。250原本参照のhash、全68 IDの被覆、30座標の原値、GeoJSONの経度緯度順とEPSG:6668、CSV/XLSXの列、公式HTMLのmarker/qを検査した。市町村CSV/XLSXとHTMLについて原典にないEPSGを付与していない。GoのEvidence型とvalidateEvidenceを実コードからそのまま抽出したprobeで30件が通過し、checkedAt日時文字列の負例は拒否された。元検証の7キー検査だけではこの日付契約は検査されない。

重点結果は `focus-findings.json`。富良野は2025年公共施設CSVの複合庁舎、剣淵は資料館と別行の絵本の館、登別は本庁舎markerのみ、天塩は枝番相違を保持して同一役場と判断、留萌は旧Google応答値と市HTMLのqを明確に分離した。千歳の名称は固定baselineで修正済みなので再訂正しない。

P05の個別 `CC_BY_4.0` 指定は一般PDL1.0で消さない。個別ページ、旧リンク先規約、現行一般規約、北海道ポータル規約のhash付き参照をレビューJSONに保存した。出典・加工の表示を保持する。個別座標事実の採否と、監査用に保存されたHTML全文・写真・地図の再公開許諾は別であり、後者は承認していない。

文書・コード・原典の差と検証不足は `document-code-discrepancies.json` に全7項目を記録した。

1. 旧名称住所照合の説明に対し、旧CSV採用コードに個別条件・CRSの記録不足。
2. 旧「建物内の複数窓口」の説明に対し、登別第2庁舎・苫小牧北庁舎に総称点を候補化。
3. 釧路の共通生成説明に留萌プラザの出典説明が混入。
4. 千歳の旧経営管理課と現総務課の差。ただしbaselineの名称は既に訂正済み。
5. P05の旧個別CC BY説明は原典と整合する。今回README第5項・policyの一般PDLの説明ではその個別指定を保持する訂正が必要。
6. 元verify.pyの7キー検査とGoの日付形式契約との検証範囲の差。候補自体のcheckedAt不適合は0件。
7. policyの仕様書locatorは「8章」と記すが、建物外周内検査は6章データ品質・本文12頁。8章はメタデータ。

`final-integrity.json` で保護対象のhash不変と訂正old値の一致を確認。元成果、manifest、固定baseline、コード、配布状態、関係を変更していない。子エージェント、branch、commit、push、PRは使用していない。38保留件について新規探索を尽くしたとは主張しない。入口・室内精度や未知の改修不存在証明は採否条件にしていない。
