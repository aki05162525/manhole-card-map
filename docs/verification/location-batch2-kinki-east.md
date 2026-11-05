# 位置調査第2弾・近畿東（Issue #40）

2026-11-05評価。**選定8、採用2（鈴鹿・洛西）、保留6**。Gemini 3.8 Flash独立再レビューで2候補承認・重大指摘0・6保留支持を得て、承認座標と根拠を変えずに採用した。台帳差分は2施設のcoordinate/evidence/locationReviewのみ。配布関係・他施設・既存ピンは不変。入口測量や竣工図自体は採用の必須条件にしない。

最初にmain `d8800718` の北海道・近畿西・甲信採用/bindingを取り込み、601→599件を検証した。その後main `65bc2e5a` の北陸・東北成果（東北2採用）も統合し、前回基準599→597件を検証した。開始時608件とは区別する。地域母集団38件のうち未位置は36件になった。

## 母集団と選定

[selection.json](../../data/national/location-batch2/kinki-east/selection.json)に調査前の8ID・方法と全38件の選定/非選定理由を保存した。Issue24 originalRefが近畿東に属する全38IDは第1弾baselineにもあり、開始manifestではすべて未位置。全地域608件は開始集合であり、採用後の推計ではない。

手動の目的抽出であり、全38件の客観的な上位8件ではない。初ピン候補・移転による棟の誤誘導を優先し、処理場・庁舎・観光施設・園地の別資料を試す8施設に区切った。非選定30件は調査済みを意味しない。太秦守衛室も同じactive/firstPin/relocation条件にあり、今回の予算から外しただけで優先度が低いと実証したものではない。京丹波2施設は曜日別窓口で、初ピンカード数と施設数を混同しない。

第1弾の京都受付・守衛室、琵琶湖疏水記念館、宇治観光センター、亀岡文化資料館の保留、およびIssue20/25/26/27の保留条件は変更しない。共有進捗文書は親担当で更新する。

## 旧レビュー後に実施した照合

[outcomes.json](../../data/national/location-batch2/kinki-east/outcomes.json)で予定した方法と実施した方法を分離し、開始時blockerと今回の変更理由を記録した。[candidates.json](../../data/national/location-batch2/kinki-east/candidates.json)は提案専用で、[decision.json](../../data/national/location-batch2/kinki-east/decision.json)の最終採否と分けている。候補原記録は変更せず、[approved-candidates.json](../../data/national/location-batch2/kinki-east/approved-candidates.json)を承認済コピーとして追加した。採用前の8保留結果もresearch-outcomes.jsonに保存した。

|施設|実施・肯定根拠|残る未確定事項と扱い|
|---|---|---|
|丹後王国|令和8年園内図の中央21情報交流センターとメインゲート付近の観光案内所を区別|市の配布先表記がどちらを指すか未確定。Vector照合未実施|
|畑川浄水場|水道ビジョン2020物理18頁の管理棟/薬品沈殿池写真と平日配布先を比較|管理棟と地理参照外形が未接続。町アクセスページに浄水場案内図リンクも見つかったが、今回は追加照合していない|
|洛西公園|運営者「管理棟南側トイレ」、GIF、GSI空中写真とBldAを比較。GIFの右≒北/下≒東ならテニス・球技場・芝生球技場・せせらぎが整合。管理棟候補9c075aa8（324.27㎡）と南東のトイレ候補c9f40153（90.47㎡）を同定|独立レビュー承認後に建物代表点を採用。GIFを北上と読む初期解釈を訂正。空中写真の撮影年は不明で現況時点を保証しない|
|鈴鹿上下水道局|401.pdf物理2/3頁の本館1096・倉庫250・別館559㎡に対し、独立取得外形は1207.30・273.86・574.94㎡。本館の細長い形、倉庫と別館の規模差も比較。市施設案内は本館1階を下水道工務課と明示|面積差10.16/9.54/2.85%を隠さず、建築面積と一般化外形は同義でないと扱う。独立レビュー承認後に本館代表点を採用。q点包含は棟同定根拠に数えない|
|京丹波町役場|2018年設計案、2021年資料物理7頁のL形平面、現アクセス図、国道9号東/27号西のBldA 2890fb14（2936.07㎡）を比較|有力外形は得たが、翼・ラウンジ張出し・屋根線の差まで確定していない。近傍4ff9系を住所点への近さだけで選ばない。竣工図必須は撤回|
|大津水再生センター|処理場平面図①管理棟と現配布案内を比較|配布先は屋上公園管理人室。同じ棟だという裏付けがない|
|安乗岬休憩舎|県PDF全11頁を画像確認。3頁事業10はH29の園地整備、4頁内訳はサイト造成150㎡・歩道舗装1000㎡・駐車場舗装1200㎡。7頁10万分1区域図で安乗崎の事業位置を確認|休憩舎個別建築・外形を示す資料ではない。区域図から建物点を読まない。灯台点は代用しない|
|宮津観光案内所|SVGの駐車場南東・二店舗西側という配置と118.51㎡のBldA 9a7e2ec8を比較。住所検索点は2345.88㎡の駐車場外形に入り、採用すると誤誘導する|府配布ページ更新4月20日は10月1日再開より前。9月30日再開告知と現tourismページでは再開後カード配布を明示確認できない。字浜3007/台帳字浜町3007の差も残す。終了や移転と断定しない|

安乗県資料は表紙だけの確認という旧問題を修正した。物理2頁方針、5頁添付様式、6/8頁の他区域図、9/10頁の5万分1図、11頁評価様式も画像確認済み。全体の公表時期を検索表示やPDF metadataから推定せず、本文の平成28年度〜令和2年度・第5回変更（令和2年12月）を資料版とした。

## 数値原典・版・権利・再現

[vector-acquisition.json](../../data/evidence/location-batch2/kinki-east/vector-acquisition.json)と[数値比較](../../data/evidence/location-batch2/kinki-east/numerical-comparisons.json)に各tileのz/x/y・bytes・hash、選択外形・属性・面積・代表点を保存した。4施設各9タイルの原本gzip PBFを証拠に保持する。取得時のPMTiles HTTP Rangeと元bytes/hashは[追加取得記録](../../data/evidence/location-batch2/kinki-east/revision-retrievals.json)、Range原本はignored workにある。レビュアーの概算や一時画像から転記した座標ではない。

出典は**国土地理院最適化ベクトルタイルを加工して作成**。当該READMEと国土地理院コンテンツ利用規約を別途取得し、PDL1.0・出典/加工表示と、基本測量成果ではなく試験公開であることを確認した。ラスターと同じ条件だと推定していない。READMEは2026年7月1日時点のデータを9月17日に更新公開と記載。個々の建物の測量日・現況反映日は不明。PMTiles metadataのversion 2は公表日ではない。

国内JGD2011地理座標に対応するWeb Mercatorタイル格子を用い、extent4096、x東/y南からlongitude/latitudeへ変換した。GRS80楕円体で面積計算、格子内の面積重心を使い、外/穴なら内部代表点に切り替える。7桁丸め後も元外形内を検査する。7桁は保存桁数であり現地精度の保証ではない。鈴鹿採用点は **緯度34.8324063、経度136.5714216**。洛西採用点は **緯度34.9080456、経度135.7071966**。数値比較にある他棟の点は比較用であり採用候補一覧ではない。

初回23原本と追加94取得はすべて版/公表日の欄を設け、判別できない版は不明とした。SVG自体の版が不明なのに「再開後版」とした旧説明を訂正した。取得日、HTTP Last-Modified、PDF生成日時はそれぞれ公表日の証明にしない。一般HTML/PDF/GIF/SVG/写真の再配布許諾は未確認のため原本はworkのみ。GSI以外の原本へPDL1.0を拡張しない。旧原本は削除していない。

[描画記録](../../data/evidence/location-batch2/kinki-east/rendering.json)に原本・物理頁・scale・出力hashを列挙した。PDFはpdftoppm、GIFはPillow、SVGはCairoSVGで描画。数値計算は[derive.py](../../data/evidence/location-batch2/kinki-east/derive.py)で再現する。図にない方位や位置を描画画像から補って採用しない。

```sh
# 数値計算環境: mapbox-vector-tile==2.2.0 shapely==2.2.0 pyproj==3.7.2
mise exec -- data/work/location-batch2/kinki-east/venv/bin/python data/evidence/location-batch2/kinki-east/derive.py > /tmp/kinki-east-derived.json
diff -u data/evidence/location-batch2/kinki-east/numerical-comparisons.json /tmp/kinki-east-derived.json
mise exec -- python3 -B data/evidence/location-batch2/kinki-east/verify.py
# 原本を保持する調査環境のみ
mise exec -- python3 -B data/evidence/location-batch2/kinki-east/verify.py --raw
```

## 採用・検証とレビュー

[Geminiレビュー結果](../../data/national/location-batch2/kinki-east/gemini-flash-review.json)と[レビュー原文](../../data/national/location-batch2/kinki-east/gemini-flash-review.md)を別記録へ保存した。Gemini Argonのquota失敗、Opus旧重大指摘とその修正、Opus再レビューrate-limit失敗はreview.jsonに履歴として保持する。Gemini 3.8 Flashの2承認はそれら失敗と別の判断。原文中の宮津「再開後SVG」は版の裏付けがないため事実認定に採用せず、版不明を維持する。原文の117原本と別保存36タイルも別集合として記録する。任意指摘の洛西座標併記とdecision status更新は反映済み。

採用行は[locations.json](../../data/national/location-batch2/kinki-east/locations.json)、bindingは[location-lifecycle.json](../../data/national/location-batch2/kinki-east/location-lifecycle.json)のbindings[0]鈴鹿・bindings[1]洛西。manifestで2IDの採用行全体hashとbindingファイルhashを明示選択した。元行・旧値・正規化hashは[prior-values.json](../../data/national/location-batch2/kinki-east/prior-values.json)、採用根拠は[adoption-evidence.json](../../data/evidence/location-batch2/kinki-east/adoption-evidence.json)に保存。元候補・原本は保持し、他地域の選択/bindingは変更していない。

初回verification.jsonは開始manifest608件の履歴、revision-verification.jsonは研究修正時点の採用0の履歴として保持する。現在の検証は[adoption-verification.json](../../data/national/location-batch2/kinki-east/adoption-verification.json)。verifyは開始manifestのdigestを再現し、現manifestから自地域選択だけ除いた基準と比較する。他地域採用を含む全施設・関係について、2IDのcoordinate/evidence/locationReview以外に差がないことを検査する。

採用テストは座標がまだNoneの状態でREDを確認し、実装後GREEN。元原調査行/旧台帳の全値・hash、採用2ID、binding identity/adoption/hash、6保留の非採用を検査する。全国Python **114テスト成功**、`mise exec -- go test -count=1 ./...` **exit 0**（実行セッションの終了コードを確認）。原本117取得・36タイル・描画hash・候補と承認済コピー・数値再計算・丸め内包も成功。既存共有テストや履歴期待値は変更していない。d8800718基準の103テストと生成結果はadoption-d880-verification.json / generated-d880-check.jsonへ履歴保存した。

実生成は保存一覧20261021・review-list20261105・as-of2026-11-05でmain基準/採用後を別出力した。入力5原本は親rootから読み取りコピーしてhashを確認し、旧取得記録を維持（[build-inputs.json](../../data/evidence/location-batch2/kinki-east/build-inputs.json)）。1313カード・1735場所・1825関係は不変、前回基準の配布施設ピン987→989、蓋ピン1309不変。生成全体未位置748→746は台帳内599→597と別集合である。

[生成検査](../../data/evidence/location-batch2/kinki-east/generated-check.json)でfull/details/pinsの内容一致と世代hash、既存ピン全件不変、追加2ピン・詳細座標、6保留のピン非生成を確認。全国監査はbefore-manifestを明示した基準と採用後で実行し、採用位置/ピン欠落0・台帳比較不一致0。既存の重複関係2件は前後不変。最初のbefore監査では現manifestを渡したため2件不一致が出たが、明示したbefore-manifestで再生成したbefore-main-audit.jsonを正しい基準にしている。

[Maps検査](../../data/evidence/location-batch2/kinki-east/maps-check.jsonl)は生成detailsの2施設と実UIのfacilityMapLink関数を用い、カード24-207-A001/26-000-B001のqueryが採用座標と一致することを確認。ブラウザー操作、外部Maps上の到達、現地・在庫・実配布継続、個別建物の測量時点、同一origin保存更新は未確認。サーバー起動・UI変更なし。マージ・CI監視は親担当。

[計時](../../data/national/location-batch2/kinki-east/timing.json)は初回288.494秒と修正調査を分けた地域共有wall時間で、今回の採用実装/検証時間は含まない。

共有変更はmanifestの自地域2採用/1bindingファイル選択追加のみ。専用テストと地域検証スクリプトを更新した。旧文書/検証の不一致（数値照合の予定と実績、資料版と取得日、安乗全体確認の過大記載、描画条件、現在608固定と採否未検査、代替モデル禁止の旧方針）は訂正済み。今回の採用に伴う「採用0・レビュー待ち・全38件不変」は現在文書から撤回し、履歴ファイルにのみ保持する。レビュー原文の宮津SVG版断定は上記のとおり訂正。新たなプロダクトコードとの不一致はない。

## 北関東統合後の競合解消

main `1f53822b`（北関東PR51採用2件を含む）を統合。manifestの同時追記を双方保持して解消し、承認済み座標・証拠・bindingは不変。現manifestと近畿東のみを除いたmanifestのassemble再集計は全国未位置597→595。上記生成検証は前回基準の履歴として保持する。今回の再検証は全国Python・非キャッシュGoテストと台帳差分。実データ再生成・ブラウザー・外部Maps・現地確認は再実施していない。
