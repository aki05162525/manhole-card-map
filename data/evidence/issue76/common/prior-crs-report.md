# 関東7都県共通：最適化ベクトルPMTilesのCRS根拠調査

結論：対象配信物の同一性、MVT格子の逆投影、入力元製品の測地系の変遷までは一次資料で追える。対象PMTilesの入力CRSと前処理・測地系変換の有無をつなぐ記録が欠けており、「本製品の測地系はJGD2011／JGD2024／WGS84で確定」とする採用承認は出さない。一般地理院タイル仕様へのリンクは有力な関連資料だが、READMEの文言は配信方式の共通性であり、測地系の明示的な準拠宣言としては弱い。

作業は読み取りと本scratchへの保存のみ。repo編集、commit、PR変更、再委任、建物個別同定、全suiteは実施していない。旧batch2の採否は承認根拠に使っていない。各取得の実UTC日時・URL・応答ヘッダー・SHA-256は `retrievals.jsonl`、該当節と限界を含む一覧は `evidence-index.json`。保存物全体の検査値は `SHA256SUMS`。一般原本はscratch内の調査用であり、配信用資産へ追加していない。

## 1. 同じ配信物を見ていること

- 対象URL：<https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles>
- 栃木 `inspection.json`、`conditions-retrievals.json`、`vector-retrievals.json`、`kanuma-vector-retrievals.json` と千葉 `rights.json`、`range-retrievals.json`、`tile-inputs.json` を確認した。根拠ファイルのコピー・hashは `local-inputs.json`。栃木・千葉のPMTiles Range記録で同じETagを確認。
- 今回 `If-Match: "dfa81a9cba11aad28247d63a2d8361ec-2015"` を付け、ヘッダー bytes=0-126 とメタデータ bytes=2503-6670 を再取得。いずれも206、同ETag、Last-Modified `Thu, 17 Sep 2026 07:32:00 GMT`、全体長16,900,763,181 bytes。全ファイルはダウンロードしておらず、全体SHA-256はない。ETagをMD5やCRS証明として扱わない。
- ヘッダーSHA-256：`063e0600eb16f8b92dea1c125f407bbfd016f2c7ee6a401898ca8de1bba05de5`。千葉の既存記録と一致。圧縮メタデータSHA-256：`1eef92d4ac644dd63ef9e046a16b0bb4be40352858ccd4563d85656b78bb4862`。
- 固定README：[c0e37e155f7773a2940fb1c2ad3da01cc6a29c90/readme.md](https://github.com/gsi-cyberjapan/optimal_bvmap/blob/c0e37e155f7773a2940fb1c2ad3da01cc6a29c90/readme.md)。新規取得SHA-256 `41a7a4d2724def73e6837516ff2661141747bceca82d81574c2eea4674bfc223` は千葉記録と一致。
- 時系列：データ基準日2026-07-01 → README履歴上の全国更新2026-09-17 → 配信物Last-Modifiedも9月17日 → 固定コミット2026-09-18 04:04:40Z。コミットの差分は表のデータ更新情報を4月1日から7月1日へ修正するもの。これらは整合するが、当該コミットに配信物のhash、ETag、生成ジョブIDを対応付けた公式マニフェストはない。7月1日を生成日・個別建物測量日とは呼ばない。

## 2. 対象物そのものから得られた生成情報

`pmtiles-metadata.json` の `generator` は `tile-join v1.36.0`。`generator_options` は縮尺別のtippecanoe生成コマンドと `tile-join -o ./26-07.mbtiles ...`。25kのコマンドは `tippecanoe -P -f -q -pf -pk -S 2 -Z 14 -z 16 -B 14 -o output/tiles-25k.mbtiles`。入力ファイル名、入力CRS、前処理コマンド、生成日、生成元のGit SHA、PMTiles変換コマンドはこの記録にない。全11トップレベルキーにもCRS/datum宣言はない。

固定公式GitHub treeは表示資産（index、style、同梱ライブラリ、glyphs、sprite、README）で、実データを作るパイプラインは収録されていない。ツリーは `truncated:false`。従って「公式デモのコードを読んだ」ことを「実データ生成コードを確認した」とは言い換えない。

補助的に、生成情報の名指すツールと同じ版の[mapbox/tippecanoe 1.36.0 projection.cpp](https://github.com/mapbox/tippecanoe/blob/1.36.0/projection.cpp)を取得。11–17行の既定投影はEPSG:4326と名付けられたlonlat入力、20–70行は球面Mercatorの数式である。記録されたコマンドには小文字 `-s/--projection` がない（大文字 `-S 2` をCRSオプションと混同しない）。**これはツールの入力解釈を説明する一次コードであり、GSIが実際に流した数値のdatumや前段変換の証明ではない。** またv1.36.0はメタデータ上のtile-join版であり、全tippecanoe呼出しの実行バイナリ版を保証しない。ツールの既定値から配信データをWGS84と断定しない。

## 3. 製品固有仕様と一般仕様の射程

- README「ベクトルタイルの仕様」はラスタと同じURL配信方式、MVT形式を述べる。PMTiles表はデータソースを数値地図（国土基本情報）―地図情報 **等** とする。測地系、EPSG、測地系変換の記載はない。ズームの表示上の対応差をXYZのzを機械的に1ずらす指示と誤読しない。
- [optbv_dataspec.pdf](https://maps.gsi.go.jp/help/pdf/vector/optbv_dataspec.pdf)：全2頁。1頁のBldA／建築物／fill、属性vt_code・vt_lvorderと25k対応などを規定。1頁2022-09-06、2頁2022-10-06更新表記。CRS定義書ではなくデータ項目表で、測地系の記載を確認できない。
- [optbv_attribute.pdf](https://maps.gsi.go.jp/help/pdf/vector/optbv_attribute.pdf)：全7頁。属性値の説明と履歴。最終履歴は2025-11-21。CRS宣言なし。featurecodes全6頁にもdatum宣言を確認できない。これらは固定READMEからリンクされるが、外部URLの内容自体がそのGitコミットに固定されるわけではない。今回取得のhashと各資料の版を分けて記録する。
- [一般地理院タイル仕様](https://maps.gsi.go.jp/development/siyou.html)「地図投影法」は国内JGD2011とMercatorを明記する。リンクと一般的な定義から本製品にも適用されると読む余地はあるが、READMEのリンク周辺は「同じ方式」のURL配信を説明しており、製品固有datumの明示とは区別する。
- 旧 `gsimaps-vector-experiment` のREADMEは別の試験製品であり、最適化PMTilesの出力CRSまで自動的に継承する根拠にはしない。

## 4. JGD2024の版変更を分けて読む

公式[標高改定Q&A](https://www.gsi.go.jp/sokuchikijun/hyoko2024rev-QA.html) Q1-6、および[日本の測地系](https://www.gsi.go.jp/sokuchikijun/datum-main.html)「日本測地系と世界測地系」は、2025年度のJGD2024への名称変更で水平座標値を引き継ぐことを説明する。2024という名前を2024年施行と解釈しない。標高・楕円体高・他の地殻変動補正まで同一と主張しない。

入力元として挙がる[数値地図の過去トピックス](https://www.gsi.go.jp/kibanjoho/kibanjoho40081.html)は、地図情報・地名情報の名称変更を **2025-05-31から** とする。全国標高改定の2025-04-01と製品への反映日は別。

[ファイル仕様の履歴ページ](https://www.gsi.go.jp/kibanjoho/kibanjoho41027.html)から旧版も取得し、5.2節を直接比較した。

|版|製品の適用時期／内容|該当箇所|
|---|---|---|
|V1.5|2021-07-30〜2025-05-30、JGD2011|000271707.pdf、PDF75頁／印刷68頁、5.2|
|V1.6|2025-05-31〜2025-07-30、JGD2024表記|000271744.pdf、PDF75頁／印刷68頁、5.2|
|V1.7|2025-07-31〜2026-05-18、参照系の記載を一部変更|000219958.pdf、5.2、更新履歴|
|V1.8|2026-05-19更新、JGD2024 / (B,L) と度単位|[000278136.pdf](https://www.gsi.go.jp/common/000278136.pdf)、PDF74頁／印刷67頁、5.2；PDF3頁の履歴|

2026-07-01という基準日に対応する公表仕様はV1.8。V1.7を現行と誤認しない。ただし、この日付一致だけでは対象PMTilesがV1.8形式の入力を使った証拠にはならない。READMEの「等」に含まれる追加ソースや縮尺別ソース、実際の投入ファイル・変換処理が未確認。入力元仕様にJGD2024と書かれている事実と、出力PMTilesのdatum断定は分ける。

## 5. MVT格子・逆投影・測地系の区別

[MVT 2.1仕様](https://github.com/mapbox/vector-tile-spec/blob/master/2.1/README.md)のProjection/Bounds、Layers、Geometryは、格子extent、左上原点、x右/y下を説明する。形式自体は任意の投影を許し、タイル内に投影・bounds情報を含めない設計なので、MVTという拡張子だけではdatumを判定できない。

本製品の公式デモ `index.html` は固定版のMapLibre 2.4.0を読み、styleは対象PMTilesのXYZを参照する。その**実際の同梱コード** `maplibre-fixed.js` の `So.prototype.toGeoJSON` はextentと2^zからlon/latを復元する式を持つ（0始まり文字位置197739、正確な位置と短い抜粋は `code-observations.json`）。主repoの `tools/national/research_common.py` の `rounded_coordinate` も同値の逆投影式である。E=extent、X/Y=タイル番号、u/v=局所格子、n=2^zとして、

```
lon = 360 * (X + u/E) / n - 180
lat = degrees(atan(sinh(pi * (1 - 2*(Y + v/E)/n))))
```

これは座標表現の復元であり、JGDからWGS84への測地系変換ではない。datum・元期・前処理の情報は式に存在しない。EPSG:3857は投影CRSの識別子であって、タイル内整数をそのままメートル座標と呼ぶことも、JGDの値をこの式だけでWGS84へ変換済みと呼ぶこともできない。出力桁数や格子分解能を現地位置の精度保証にしない。

## 6. 共通の欠落条件と親への引き継ぎ

全県で同じ一般検索を繰り返す必要はない。同URL・ETag・ヘッダーhashを用いる候補にはこの証拠束を共通参照できる。各県では自分のRange原本とETag、tile z/x/y、extent、加工履歴の対応を確認する。別ETag・別版・別レイヤーを自動的に承認しない。

測地系を確定するには、次のいずれかが必要。

1. 国土地理院による当該optimal_bvmap-v1/PMTiles（対象データ版・配信世代を特定）の水平datum宣言。または一般タイル仕様のdatum節がこの製品に適用されるという明示。
2. 当該配信物につながる入力ファイル版・CRS、前処理・投影・測地系変換の有無、生成ツールとオプション、最終配信物との対応を示す公式生成記録。BldAを使う場合は25k/BldAまでソース系統を特定する。

問い合わせを行うなら「2026-07-01データ、上記ETagのBldAについて、入力の水平datumは何か、MVT化の前にdatum変換をしたか、逆投影した経緯度をJGD2024（旧称JGD2011）として扱ってよいか」を一度まとめて確認すればよい。今回は外部へ問い合わせは送っていない。

根拠不足は座標が誤っている証拠でも、不採用確定の判断でもない。製品datumの確認を要する採用基準に対して、未解決点を局所化した状態として親に返す。

## 7. 記録・仕様の不一致と未確認範囲

- 栃木の記録は旧調査の一般仕様適用を紹介し、千葉・main北陸の記録は製品固有適用を未解決としている。過去採用の差を技術的なdatum証拠として採用しない。今回の結論は製品固有適用未確定に統一。
- 一般タイルWebページは現在もJGD2011表記、一方入力元地図情報のV1.8はJGD2024表記。公式の名称変更説明により水平値が変わったという矛盾とは断定できないが、表記差と版の違いは残す。
- 調査中に見つけた公式READMEと実コードの不一致：READMEのPMTiles読み込み例は `./pmtiles@2.10.0/index.js`、実際の `index.html` は `./lib/pmtiles@2.10.0/index.js`。コード側を参照した。CRSの結論には影響しない。
- 全PDFのテキスト抽出・対象節読解、固定README/hash照合、HTTP Range再取得、生成メタデータと公式同梱逆投影コードの確認を実施。PDFの全図版の目視検査、全建物・全県タイル、生成パイプラインの実行、全PMTiles hash、アプリsuite、個別施設同定は未実施。公式リポジトリ全体の生成コード不存在を一般化せず、確認した固定treeと検索範囲に限る。
