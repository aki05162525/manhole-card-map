# 位置調査第2弾・近畿東（Issue #40）

2026-11-05評価。**選定8、建物代表点の提案2（鈴鹿・洛西）、最終採用0、保留8**。鈴鹿・洛西は独立再レビュー待ち、ほか6件は資料対応に未確定事項がある。manifest・台帳・配布関係・既存位置は変更していない。入口測量や竣工図の入手自体を採用の必要条件にはしない。

## 母集団と選定

[selection.json](../../data/national/location-batch2/kinki-east/selection.json)に調査前の8ID・方法と全38件の選定/非選定理由を保存した。Issue24 originalRefが近畿東に属する全38IDは第1弾baselineにもあり、開始manifestではすべて未位置。全地域608件は開始集合であり、採用後の推計ではない。

手動の目的抽出であり、全38件の客観的な上位8件ではない。初ピン候補・移転による棟の誤誘導を優先し、処理場・庁舎・観光施設・園地の別資料を試す8施設に区切った。非選定30件は調査済みを意味しない。太秦守衛室も同じactive/firstPin/relocation条件にあり、今回の予算から外しただけで優先度が低いと実証したものではない。京丹波2施設は曜日別窓口で、初ピンカード数と施設数を混同しない。

第1弾の京都受付・守衛室、琵琶湖疏水記念館、宇治観光センター、亀岡文化資料館の保留、およびIssue20/25/26/27の保留条件は変更しない。共有進捗文書は親担当で更新する。

## 旧レビュー後に実施した照合

[outcomes.json](../../data/national/location-batch2/kinki-east/outcomes.json)で予定した方法と実施した方法を分離し、開始時blockerと今回の変更理由を記録した。[candidates.json](../../data/national/location-batch2/kinki-east/candidates.json)は提案専用で、[decision.json](../../data/national/location-batch2/kinki-east/decision.json)の最終採否と分けている。

|施設|実施・肯定根拠|残る未確定事項と扱い|
|---|---|---|
|丹後王国|令和8年園内図の中央21情報交流センターとメインゲート付近の観光案内所を区別|市の配布先表記がどちらを指すか未確定。Vector照合未実施|
|畑川浄水場|水道ビジョン2020物理18頁の管理棟/薬品沈殿池写真と平日配布先を比較|管理棟と地理参照外形が未接続。町アクセスページに浄水場案内図リンクも見つかったが、今回は追加照合していない|
|洛西公園|運営者「管理棟南側トイレ」、GIF、GSI空中写真とBldAを比較。GIFの右≒北/下≒東ならテニス・球技場・芝生球技場・せせらぎが整合。管理棟候補9c075aa8（324.27㎡）と南東のトイレ候補c9f40153（90.47㎡）を同定|建物代表点を提案。GIFを北上と読む初期解釈を訂正。空中写真の撮影年は未確認なので現況時点の保証はしない。独立レビュー待ち|
|鈴鹿上下水道局|401.pdf物理2/3頁の本館1096・倉庫250・別館559㎡に対し、独立取得外形は1207.30・273.86・574.94㎡。本館の細長い形、倉庫と別館の規模差も比較。市施設案内は本館1階を下水道工務課と明示|面積差10.16/9.54/2.85%を隠さず、建築面積と一般化外形は同義でないと扱う。本館代表点を1件提案。q点包含は棟同定根拠に数えない|
|京丹波町役場|2018年設計案、2021年資料物理7頁のL形平面、現アクセス図、国道9号東/27号西のBldA 2890fb14（2936.07㎡）を比較|有力外形は得たが、翼・ラウンジ張出し・屋根線の差まで確定していない。近傍4ff9系を住所点への近さだけで選ばない。竣工図必須は撤回|
|大津水再生センター|処理場平面図①管理棟と現配布案内を比較|配布先は屋上公園管理人室。同じ棟だという裏付けがない|
|安乗岬休憩舎|県PDF全11頁を画像確認。3頁事業10はH29の園地整備、4頁内訳はサイト造成150㎡・歩道舗装1000㎡・駐車場舗装1200㎡。7頁10万分1区域図で安乗崎の事業位置を確認|休憩舎個別建築・外形を示す資料ではない。区域図から建物点を読まない。灯台点は代用しない|
|宮津観光案内所|SVGの駐車場南東・二店舗西側という配置と118.51㎡のBldA 9a7e2ec8を比較。住所検索点は2345.88㎡の駐車場外形に入り、採用すると誤誘導する|府配布ページ更新4月20日は10月1日再開より前。9月30日再開告知と現tourismページでは再開後カード配布を明示確認できない。字浜3007/台帳字浜町3007の差も残す。終了や移転と断定しない|

安乗県資料は表紙だけの確認という旧問題を修正した。物理2頁方針、5頁添付様式、6/8頁の他区域図、9/10頁の5万分1図、11頁評価様式も画像確認済み。全体の公表時期を検索表示やPDF metadataから推定せず、本文の平成28年度〜令和2年度・第5回変更（令和2年12月）を資料版とした。

## 数値原典・版・権利・再現

[vector-acquisition.json](../../data/evidence/location-batch2/kinki-east/vector-acquisition.json)と[数値比較](../../data/evidence/location-batch2/kinki-east/numerical-comparisons.json)に各tileのz/x/y・bytes・hash、選択外形・属性・面積・代表点を保存した。4施設各9タイルの原本gzip PBFを証拠に保持する。取得時のPMTiles HTTP Rangeと元bytes/hashは[追加取得記録](../../data/evidence/location-batch2/kinki-east/revision-retrievals.json)、Range原本はignored workにある。レビュアーの概算や一時画像から転記した座標ではない。

出典は**国土地理院最適化ベクトルタイルを加工して作成**。当該READMEと国土地理院コンテンツ利用規約を別途取得し、PDL1.0・出典/加工表示と、基本測量成果ではなく試験公開であることを確認した。ラスターと同じ条件だと推定していない。READMEは2026年7月1日時点のデータを9月17日に更新公開と記載。個々の建物の測量日・現況反映日は不明。PMTiles metadataのversion 2は公表日ではない。

国内JGD2011地理座標に対応するWeb Mercatorタイル格子を用い、extent4096、x東/y南からlongitude/latitudeへ変換した。GRS80楕円体で面積計算、格子内の面積重心を使い、外/穴なら内部代表点に切り替える。7桁丸め後も元外形内を検査する。7桁は保存桁数であり現地精度の保証ではない。鈴鹿提案点は **緯度34.8324063、経度136.5714216**。洛西提案点はcandidates.json参照。数値比較にある他棟の点は比較用であり採用候補一覧ではない。

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

## 検証とレビュー

初回[verification.json](../../data/national/location-batch2/kinki-east/verification.json)は開始manifestに対する履歴結果として保持した。verifyは保存した開始manifestで608件と元ledger digestを確認し、現manifestでは地域38件の全フィールド不変性を検査して現在の全国件数を別出力する。他地域採用に合わせて608やdigestを書き換える必要はない。

decisionのheldIdsを空にしても旧verifyがexit 0となる失敗を再現した。採否集合、集計、全取得status/bytes/版/hash、原本・描画hashを検査する修正と専用回帰テストを追加。今回の原本117取得と数値36タイルの整合検査は成功した。Python全97テストとGo全非キャッシュ実行はともにexit 0。結果・ログhashは[修正検証JSON](../../data/national/location-batch2/kinki-east/revision-verification.json)に記録した。採用未実装なのでbuilddata再生成・Maps/UI確認はまだ実施していない。採用する場合はbinding/manifest、許可ID/旧値/hash/全台帳差分テスト、生成・監査検証を別途実施する。

[計時](../../data/national/location-batch2/kinki-east/timing.json)は初回288.494秒と今回の修正調査を分け、施設に重複配賦しない。後続の全体検証・レビュー・採用実装時間は調査時間と混同しない。

Gemini 4 ArgonはAntigravity quota超過で失敗し、レビュー未実施だった履歴を保持する。その後、ユーザーがClaude Opus代替レビューを明示許可した。旧Opusの重大指摘と対応は[review.json](../../data/national/location-batch2/kinki-east/review.json)へ個別記録。修正後に新規Opus独立レビューを依頼する。レビュー前の候補自動採用はしない。PRはDraftで、マージとCI監視は親担当。

共有ファイルの変更はない。今回見つけて訂正した文書/実装の不一致は、数値外形未試行なのに完了を思わせる停止条件、資料版と取得時期の混同、安乗全体確認の過大記載、未記録の描画頁/scale、verifyの現在値固定・採否未検査、代替モデルを使わないという旧方針の残存。プロダクトのコード/動作は変更していない。
