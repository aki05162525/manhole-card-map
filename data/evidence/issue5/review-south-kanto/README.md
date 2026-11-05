# Issue #5 南関東9候補の独立レビュー

2026-11-05、AIによる資料照合。結果は **accepted 9 / deferred 0 / correction-required 0**。判定は建物位置の追加に限定する。原本公開の包括的許諾、配布状態変更、manifest採用は含まない。

全9施設IDの判定・既存配布関係・根拠は `data/national/issue5/reviews/south-kanto.json` に収録。元候補、manifest、コードを編集せず、子起動・commit・branch・push・PR操作は行っていない。横浜駅観光案内所とupdates外の66件は対象外。

## 検証方法と結果

候補作者のvalidation.jsonを合否根拠にはせず、保存原ZIP・CSV・HTMLを読み直した。主要配布ページ、三鷹アクセス、東京都案内所、P05個別条件・利用規約はwebツールでも再確認した。webツールの閲覧結果はダウンロード原本として保存していない。数値検証とハッシュは既存保存bytesに対して実施し、取得時刻を推定・新規取得扱いにしていない。

- `source-index.json`：30保存原本のURL、相対パス、SHA256。全件再計算して一致。三鷹accessの簡略参照で省略されていたhashもこの一覧では実測記録した。
- `coordinate-checks.json`：ZIP内の4個別Featureを6施設IDに対応させた原値・CRSと、綾瀬CSVの元の文字列行。派生資料であってダウンロード原本ではない。
- `validation.json`：候補hash、9 ID、Go検証出力、CRS、状態維持の検査結果。

`cmd/builddata/ledger.go` のEvidence型とvalidateEvidence関数をそのまま一時Goハーネスに抽出し、各候補evidenceをDisallowUnknownFields付きでデコードした。7フィールドの完全一致、URL・日付・actorType・説明・原本hashの実装検査が9件とも成功した。補助資料のrole等は候補のEvidence内へ入れていない。検証用ハーネスはリポジトリ外で実行し、製品コードの変更なし。

実際の `tools/national/assemble.py::apply_locations` を固定baselineへメモリ上で適用し、9件の位置追加が通ることとrelations全体の完全不変を確認した。出力台帳・manifestは書き出していない。scopeは候補側の建物精度説明であり、GoのEvidenceに新フィールドとして渡していない。

## P05の6施設

出典は国土交通省「国土数値情報 市町村役場等及び公的集会施設データ」2022年4月。[データ詳細](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html)と[利用規約](https://nlftp.mlit.go.jp/ksj/other/agreement.html)を確認した。

原ZIPは `data/evidence/national/kanto-south-locations-kanagawa/202bb7bb6256b7f5b65e.zip`、SHA256は `13449bfe8a57ba522fd7a4035ef02d97ffb930f654044c5a26ce6ac316213759`。`P05-22_14.geojson` のCRSは `urn:ogc:def:crs:EPSG::6668`。次の経度・緯度原値を入れ替えてlat/lngへ転記したことを検査した。変換や丸めはしていない。

| 配布建物 | Feature index | 原値 [経度, 緯度] | 対象件数 |
| --- | ---: | --- | ---: |
| みなくる／ココロット鶴ヶ峰 | 239 | [139.55003436557533, 35.47484467697792] | 1 |
| 伊勢原市役所駅窓口センター | 1180 | [139.31351027970655, 35.396031339519574] | 1 |
| 大井町役場 | 1441 | [139.15664581966178, 35.326701516848516] | 2 |
| 清川村役場 | 1544 | [139.2763758732199, 35.48233019463441] | 2 |

[旭区のカード案内](https://www.city.yokohama.lg.jp/asahi/shokai/gaiyo/mascot/asahikunmanhorukado.html)には区役所に続いてみなくるも配布先として載る。施設案内はココロット4階への導線を示す。部分抽出ではみなくるを見落とすため、全文の配布節を確認した。

[伊勢原のカード案内](https://www.city.isehara.kanagawa.jp/docs/2024070800023/)は2024年8月3日から休日配布を駅窓口へ変更したと説明する。現行施設案内の小田急マルシェ2階とP05専用施設Pointが対応する。平日アクアクリーンセンターへは流用しない。

[大井町](https://www.town.oi.kanagawa.jp/soshiki/9/manho-ruka-do.html)の平日・休日窓口はともに役場1階。[清川村](https://www.town.kiyokawa.kanagawa.jp/soshiki/machizukuri/3480.html)も環境上下水道課と宿直室を役場1階と明記する。同番地のせせらぎ館へ読み替えていない。いずれも公開施設Pointによる建物案内であり、入口・室内窓口を測量した位置ではない。

個別データページはオープンデータの利用条件を示し、現行サイト規約はPDL1.0、出典・加工表示、個別条件優先を定める。候補のsourceLocator/verificationMethodには出典、2022年4月、JGD2011、抽出加工、無変換が追補されている。WGS84変換済みとは扱わない。公開成果にはこの表示を保持する。P05の利用条件を自治体案内HTMLや写真に拡張しない。

## 浦安・綾瀬・三鷹

浦安は[市配布案内](https://www.city.urayasu.lg.jp/todokede/machi/douro/1046287/1030971.html)の治水課6階・猫実1-1-1と、[市役所施設案内](https://www.city.urayasu.lg.jp/shisetsu/shikanren/shiyakusho/1005488.html)の `q=35.653053,139.901982` が同じ建物を示す。A001の平日配布とB001の博物館休館日配布を照合した。1階守衛室と建物点を共有するが、旧道路整備課の関係・移転日・現配布を承認する変更ではない。

綾瀬は公共施設CSVのseq=0、施設名「綾瀬市役所」、所在地「早川550番地」、緯度 `35.437177`、経度 `139.42616` をcp932で読み直した。拡張子.htmlの保存原本は実体がCSV。[市のオープンデータ掲載ページ](https://www.city.ayase.kanagawa.jp/soshiki/johoseisakuka/johokokai_kojinjohohogo_gyoseifufukushinsa/5822.html)は当該CSVをCC BY 4.0で公開し、派生成果への掲載ページリンクを求める。数値出典・ライセンス・加工を保持する。

[綾瀬の配布案内](https://www.city.ayase.kanagawa.jp/soshiki/shokosinkoka/sangyorenkeitanto/kanko_tokusan/dezainmanhoru/index.html)は11月22日の文化会館駐車場イベントと11月24日以降の市役所5階を区別し、後者は在庫次第としている。`upcoming`、`validFrom=2026-11-24`、`reviewUntil=2026-11-23` をそのまま保持。予定の取消しや配布場所変更の可能性もあり、位置採用は当日の配布保証ではない。

三鷹は[観光協会アクセス](https://kanko.mitaka.ne.jp/about/accsess.html)が101号室と105号室を同じ三鷹駅前協同ビルと明記し、共通地下駐輪場も説明する。[東京都の案内所ページ](https://tokyotouristinfo.com/detail/M0254)の `destination=35.702080,139.562138` をBASEの建物点として共有できる。105号室の室内点という主張はしない。カード配布記事の11月10～15日臨時休業とbaselineの `reviewUntil=2026-11-09` は維持する。

浦安・三鷹は公式HTMLに明示された目的地数値を採用した。Google地図画面・viewport・API応答から新たに取得した値ではない。測地系の明記がなく変換はしていない。位置採用とHTML・写真・第三者地図の再配布は別判断であり、これら原本の一括公開を承認しない。「以前採用済み」自体を再利用許諾の根拠にはしていない。

## 発見した相違

1. 元READMEの「再検証」とvalidation.jsonのchecksはP05のJGD2011 CRS検証を含むが、元 `validate.py` はFeatureの座標一致を調べるだけでGeoJSONのcrsをassertしていない。今回の独立検証でEPSG::6668の一致を追加確認した。READMEの「文書とコードの不一致なし」はこの点で訂正が必要。元コードは変更していない。
2. `building-verification.json` のP05六件は出典・CRS・加工説明の「追補が必要」という旧表現を残す。一方、updates六件は既に補足済みで、READMEの追補済みという説明は候補と整合する。補助文書の時点表現の相違であり、候補のEvidence不足ではない。

そのほか、Go Evidenceに非対応フィールドはなく、9候補の採用を止める文書・コード相違は見つからなかった。
