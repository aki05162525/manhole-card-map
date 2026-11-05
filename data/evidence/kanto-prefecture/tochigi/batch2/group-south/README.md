# 栃木南群5施設・追加調査

出力は全てignored work。共有manifest・追跡ファイル・既存raw・HEADは変更なし。候補5IDは独立採用未承認。

- `outcomes.json`: 5ID別の配布/棟/数値/残る理由。`inherited-history.json`: 原台帳・既往参照とhash。
- `locations-proposed.json`, `location-lifecycle-proposed.json`, `selection-proposed.json`: 現schemaに合わせた候補。採用承認ではない。ignored rawパスのままなので追跡領域への移送・再bindingは親の統合作業。
- `mibu-numeric-check.json`: 2窓口主棟37代表点。37/52/53はMultiPolygonなので一体Polygonと誤記しない。完成フロア図URL404、現案内と設計の対応を記録。
- `oyama-numeric-check.json`: 2窓口本庁舎65+隣接17。17は65のbuffer内に包含、union重複排除。2026年4月版公式図2頁とカード図1頁を全頁読解。
- `shikisaikan-human-response.json`: 今回回答、確認日未提示を保持。`shikisaikan-numeric-check.json`: 352候補。名称付き市marker・看板写真・周辺配置と比較。航空写真撮影年不明・影があり独立棟承認待ち。
- `timing.jsonl`: 実時刻で記録。共有区間は混在を明記し後付け配賦しない。
- `validation.json`, `check-results.log`: 5件の候補/binding/selection/原本hash、18新規タイルとRange原本hash/版一致、凍結入力不変。終了0。全suite・tracked verify.py・UI試験は未実行。

製品固有CRS一次根拠は県共通で未確認。座標計算成功をCRS・棟同定・配布可否の承認としない。旧市CSV座標をDMS変換せず、市GIS再利用制限も回避しない。一般PDF/写真のGit再配布は未承認。

新たなdoc/code不一致は発見なし。原調査と後続根拠の差：壬生旧nextSource(2026110400033)は庁舎配置資料ではなかった。旧P05地点を新庁舎と判断した小山原調査はIssue20保留を継承し、今回別外形で候補化した。これらは履歴を消さず保持する。
