# waterworks 群の調査証跡

10 IDすべてで現配布原本・既往記録・建物図・GSI数値外形を調べた。7棟の座標案、3件の棟対応未確定。全件未承認、manifest未反映。採用や在庫更新はしていない。

- `data/national/kanto-prefecture/saitama/groups/waterworks/outcomes.json`が施設別結論。`locations.json` は現7項目Evidence契約の候補案、`selection.json` の採用対象は空。`bindings.json` に全10件の旧施設/旧配布関係/旧値/hash、`relation-candidates.json` に座標から独立した休日窓口案。
- `retrievals.json` は一般原本のHTTP取得metadataとhash。一般PDF/HTML/画像全文は ignored work にのみ保存。失敗は404本文hashも保持。Range失敗は今回発生していない。GSIの各ディレクトリは9タイル原本、`ranges.json` は206/版/ETag/再利用元取得日時を保持。
- 県の `all.pdf` は325物理頁。全文text検索は実施したが、全325頁の目視読了はしていない。配置図55、98、148、149、150、197、231、258、284、308頁を画像で確認。149頁は別施設の新河岸川**上流**センターで今回右岸支社へ代用しない。県概要は令和6年度版、図の年月は施設ごとに異なる（中川図はR4.8）。
- JS配布PDFは全2頁を目視。元荒川アクセスPDFは1頁の広域案内図を目視。中川R7脱硫剤仕様書は21頁中17頁の配置図を目視、本文全文抽出/検索を実施したが他20頁の画像は全読していない。公社アクセス画像（南部/右岸/古利根川）と県H30航空写真（市野川/荒川上流/小山川）は全画像を目視。
- 全景SVGはBldA/RdCL/RdEdg/WA/WLの全feature（面積閾値なし）を描画、原タイルのbufferも描く。各 `window.json` に全景/番号入り局所PNGの保存先と局所bounds。全9タイルの全景を確認したうえで局所照合。初期の市野川・荒川上流は住所代表点が対象棟とずれたためtarget窓を追加取得し、初期範囲も残す。描画PNGは調査用work。
- `*-geometry.json` は7候補の原feature、vt_code/vt_lvorder、原タイルSHA、外形SHA、面積、小数7桁丸め前後内包。`*-considered-geometries.json` は未確定3件も含めて検討した原外形を残す。全7候補の採用外形は原タイル端/取得外周に触れない。管理棟と同定できない外形について内点が作れるだけで候補へ昇格しない。
- GSI製品版/利用条件は県共通 `data/evidence/kanto-prefecture/saitama/source-conditions.json` を継承。版2026-07-01、HTTP Last-Modified 2026-09-17、ETag dfa81a9cba11aad28247d63a2d8361ec-2015。製品固有CRS適用は未承認。計算は4096格子XYZ、北上y南、WebMercator逆投影、測地系変換なし。7桁は保存桁数で測量精度でない。国土地理院最適化ベクトルタイルをmanhole-card-mapが加工。PDL1.0原本hash/取得日時は共通証跡を参照し、新規取得扱いしない。
- `timing.json` は開始時に記録した施設別wall-clock区間。待ち/会話も含む。市野川の区間中に3候補の共通計算を実施したため純施設別工数と解釈しない。初期共通資料探索と最終共通整理は後付配賦しない。
- 再現用 `research-vector.py` / `research-geometry.py` は調査補助、アプリ/共通実装変更ではない。Python system環境にはPILが無くcontact sheetの初回作成は失敗、指定venvで再実行成功。原本照合をテスト成功で置換しない。全suite/commit/pushは担当親へ引継ぎ、ここでは局所hash/再decode/丸め内包検査だけを行う。

利用者回答「守衛室は正門脇の独立小棟」は2026-11-06受領（親から転送）。2026-11-05調査確認日とは別。外形494/498等の特定は回答に含まれず未確定。6管理棟の追加質問は旧human-confirmation-queue/issue57-human-queue/県historyに回答なしを確認し、公式図の物理頁付きで `human-questions.json` に記録した。公社各支社accessは住所/広域案内を示すが、今回候補の6管理棟へ直接結ぶカード窓口ラベルは確認できない。

文書とコードの不一致：今回新規発見なし。原本間の休日配布終了時刻（公社16:30/県17:00）と旧台帳の休日別窓口欠落候補は別途明記した。
