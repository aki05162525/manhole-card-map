# 三浦半島担当5施設の引継ぎ

確認基準日は2026-11-05。HTTP取得日時はretrievals.json、実施区間はtiming.json（共有区間は分割配賦しない）。一般原本はignored data/work/kanto-kanagawa/peninsula/に保存し、Git/配信には混入していない。新しい確認日への置換はしていない。

- ヴェルニー: 公式園内SVG全図とパンフ2/2頁、指定管理者本文で管理事務所とテレワークセンターの同棟を確認。291の代表点候補。
- 三浦: 市2026-05-22工期延長発表で旧2026年4月移転予定を更新。城山1-1の現配布案内と周辺図1/1頁、階別図1/1頁を照合。244は東の旧教室棟と結合外形なので、西側の第2分館内部を選ぶ。点XY[4880,6080]は図の名称・西北凹部・南西張出に基づく棟代表点で、室内窓口測量ではない。point.jsonに元geometry/選択点/内包と結合範囲面積を保存。
- 葉山: 公式カード/公園/博物館案内と全概略図・入口写真を読解、周辺8外形を比較したが受付棟の名称bindingがない。博物館を代用しない。既存の質問案は未回答。原本・数値照合後も配布棟が不明なため、outcomesに具体的一問を記録して親へ送付。
- 衣笠: 市現案内、商店街PDF2/2頁、公式ブース写真2枚、同住所医院の自社図・写真を比較。センターは交番横小屋だが独立外形と断定不能。事務所は商栄会館境界未確定。一問を親へ送信済み。

各tiles/rangeファイルにPMTiles版2026-07-01とHTTP Range検証を保持。2023-10-01版XYZを混在させない。製品CRS・条件の共通確認は県親が担当。数値検査の成功を独立棟同定や採用承認に代えない。manifest未反映。

reproduction-*.py.txtは実行時スクリプトの保存。/tmpに同名peninsula_*.pyとして置き、リポジトリルートから実行する。tiles→detailの描画範囲は各observation、pointは保存geometryとpointXYからresearch_common.rounded_coordinateを再計算できる。三浦は汎用representative_pointを再実行しない（旧教室棟側に入り得る）。validation.jsonのコマンドは保存済み数値を再計算する。初回検証補助コードのschema分岐誤りと修正も記録。

県統合用のoutcomes/locations/lifecycle/selection-proposed/baselineは data/national/kanto-prefecture/kanagawa/peninsula/。baselineに親scopeから継承した各ID全履歴/旧値/関係を保管。新規配布関係修正案なし。全suite・commit・pushは実施していない。発見した文書とコードの仕様不一致なし。古い三浦移転予定と新公式発表の差は資料更新履歴としてobservationに記録。

2026-11-06利用者回答追記: 商栄会館と西友の同棟回答はkinugasa-office-user-report.jsonに分離。再読・7外形数値比較はfollowup-observation/comparison。同棟報告は受領済みだが、西友棟と数値外形の独立対応は未確定のため候補追加なし、追加質問なし。旧観察は過去の未回答状態として保存。
